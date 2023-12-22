// ==UserScript==
// @name        Pixiv Extender
// @name:ja     Pixiv Extender
// @name:zh-CN  Pixiv Extender
// @name:zh-TW  Pixiv Extender
// @namespace   https://github.com/Kakejoyu/PixivExtender
// @version     1.0.1
// @icon        https://www.pixiv.net/favicon.ico
// @description "Pixiv Extender" is a user script derived from "Pixiv Plus" that adds various features to Pixiv. Thanks to Ahaochan, the developer of "Pixiv Plus"!
// @description:ja    「Pixiv Extender」は、Pixivに様々な機能を追加する「Pixiv Plus」から派生したユーザースクリプトです。「Pixiv Plus」の開発者であるAhaochanに感謝します！
// @description:zh-CN "Pixiv Extender"是从 "Pixiv Plus "衍生出来的用户脚本，它为 Pixiv 添加了各种功能。 感谢 "Pixiv Plus "的开发者 Ahaochan！
// @description:zh-TW "Pixiv Extender"是從 "Pixiv Plus "衍生出來的使用者腳本，它為 Pixiv 增加了各種功能。 感謝 "Pixiv Plus "的開發者 Ahaochan！
// @author      Kakejoyu
// @supportURL  https://github.com/Kakejoyu/PixivExtender/issues
// @match       http*://www.pixiv.net/*
// @connect     i.pximg.net
// @connect     i-f.pximg.net
// @connect     i-cf.pximg.net
// @license     GPL-3.0
// @grant       unsafeWindow
// @grant       GM.xmlHttpRequest
// @grant       GM.setClipboard
// @grant       GM.setValue
// @grant       GM.getValue
// @grant       GM.listValues
// @grant       GM.deleteValue
// @grant       GM_addStyle
// @grant       GM_xmlhttpRequest
// @grant       GM_setClipboard
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_listValues
// @grant       GM_deleteValue
// @require     https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.4/jquery.min.js
// @require     https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.4/jszip.min.js
// @require     https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/1.3.2/FileSaver.min.js
// @require     https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.1.6/gif.js
// @require     https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// @run-at      document-end
// @noframes
// ==/UserScript==

/*! Pixiv Extender | GPL-3.0 license | https://github.com/Kakejoyu/PixivExtender/blob/main/LICENSE */

jQuery(($) => {
    "use strict";
    // 加载依赖
    // ============================ jQuery插件 ====================================
    $.fn.extend({
        fitWindow() {
            this.css("width", "auto")
                .css("height", "auto")
                .css("max-width", "")
                .css("max-height", $(window).height());
        },
        replaceTagName(replaceWith) {
            const tags = [];
            let i = this.length;
            while (i--) {
                const newElement = document.createElement(replaceWith);
                const thisi = this[i];
                const thisia = thisi.attributes;
                for (let a = thisia.length - 1; a >= 0; a--) {
                    const attrib = thisia[a];
                    newElement.setAttribute(attrib.name, attrib.value);
                }
                newElement.innerHTML = thisi.innerHTML;
                $(thisi).after(newElement).remove();
                tags[i] = newElement;
            }
            return $(tags);
        },
        getBackgroundUrl() {
            const imgUrls = [];
            this.each(function (index, { style }) {
                let bgUrl = $(this).css("background-image") || style.backgroundImage || 'url("")';
                const matchArr = bgUrl.match(/url\((['"])(.*?)\1\)/);
                bgUrl = matchArr && matchArr.length >= 2 ? matchArr[2] : "";
                imgUrls.push(bgUrl);
            });
            return imgUrls.length === 1 ? imgUrls[0] : imgUrls;
        },
    });

    let globalData;
    let preloadData;
    const initData = () => {
        $.ajax({
            url: location.href,
            async: false,
            success: (response) => {
                const html = document.createElement("html");
                html.innerHTML = response;
                globalData = JSON.parse(
                    $(html).find('meta[name="global-data"]').attr("content") || "{}"
                );
                preloadData = JSON.parse(
                    $(html).find('meta[name="preload-data"]').attr("content") || "{}"
                );
            },
        });
    };

    const lang = (document.documentElement.getAttribute("lang") || "en").toLowerCase();
    let illustJson = {};

    const illust = () => {
        // 1. 判断是否已有作品id(兼容按左右方向键翻页的情况)
        const preIllustId = $("body").attr("pe_illust_id");
        const paramRegex = location.href.match(/artworks\/(\d*)$/);
        const urlIllustId = !!paramRegex && paramRegex.length > 0 ? paramRegex[1] : "";
        // 2. 如果illust_id没变, 则不更新json
        if (parseInt(preIllustId) === parseInt(urlIllustId)) {
            return illustJson;
        }
        // 3. 如果illust_id变化, 则持久化illust_id, 且同步更新json
        if (!!urlIllustId) {
            $("body").attr("pe_illust_id", urlIllustId);
            $.ajax({
                url: `/ajax/illust/${urlIllustId}`,
                dataType: "json",
                async: false,
                success: ({ body }) => (illustJson = body),
            });
        }
        return illustJson;
    };
    const getUid = () => {
        if (!preloadData || !preloadData.user || !Object.keys(preloadData.user)[0]) {
            initData();
        }
        return preloadData && preloadData.user && Object.keys(preloadData.user)[0];
    };
    const observerFactory = function (option) {
        let options;
        if (typeof option === "function") {
            options = {
                callback: option,
                node: document.getElementsByTagName("body")[0],
                option: { childList: true, subtree: true },
            };
        } else {
            options = $.extend(
                {
                    callback: () => {},
                    node: document.getElementsByTagName("body")[0],
                    option: { childList: true, subtree: true },
                },
                option
            );
        }
        const MutationObserver =
            window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;

        const observer = new MutationObserver((mutations, observer) => {
            options.callback.call(this, mutations, observer);
            // GM.getValue('MO', true).then(function (v) { if(!v) observer.disconnect(); });
        });

        observer.observe(options.node, options.option);
        return observer;
    };
    const isLogin = () => {
        let status = 0;
        $.ajax({
            url: "https://www.pixiv.net/setting_user.php",
            async: false,
        }).done((data, statusText, xhr) => (status = xhr.status));
        return status === 200;
    };

    // ============================ 配置信息 ====================================
    const GMkeys = {
        MO: "MO", // MutationObserver 的开关
        selectorShareBtn: "selectorShareBtn", // 下载按钮的selector
        switchImgSize: "switch-img-size", // 是否显示图片大小的开关
        switchImgPreload: "switch-img-preload", // 是否预下载的开关
        switchImgMulti: "switchImgMulti", // 是否自动加载多图的开关
        downloadName: "download-name", // ダウンロード名のパターン
    };

    // ============================ i18n 多言語対応 ===============================
    const i18nLib = {
        ja: {
            load_origin: "元の画像を読み込み",
            ad_disable: "広告の無効化",
            search_enhance: "検索を強化",
            download_able: "ダウンロードを可能に",
            artist_info: "アーティスト情報を表示",
            comment_load: "コメントの読み込み",
            artwork_tag: "フィードでの作品種別表示",
            redirect_cancel: "リダイレクトのバイパス",
            history_enhance: "閲覧履歴の強化",
            watchlist: "ウォッチリストに追加",
            favorites: "users入り",
            search_help_title: "検索機能強化のヘルプ",
            search_help_body:
                "<ui><li><code>fav:[数値]</code>：<code>[数値]users入り</code>を検索します</li><li><code>fav:[数値1]-[数値2]</code>：以下のリストでの[数値1]から[数値2]までの<code>users入り</code>を検索します</li><li><code>users入り</code>の数値一覧<br>5, 10, 30, 50, 100, 200, 250, 300, 500, 800, 1000, 3000, 5000, 7500, 10000, 30000, 50000, 100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000</li><li><code>uid:[ユーザーID]</code>：[ユーザーID]のプロフィールページに移動します</li><li><code>uname:[ユーザー名]</code>：[ユーザー名]でユーザーを検索します</li><li><code>pid:[作品ID]</code>：[作品ID]の作品ページに移動します</li></ui>",
            search_fav_err:
                "正しい「users入り」の数値を入力してください。詳しくは検索ボックス右側の「?」ボタンからヘルプを参照してください。",
            illegal: "無効",
            download: "ダウンロード",
            download_wait: "ダウンロード完了までお待ちください",
            gif_not_loaded: "Gifがまだ読み込まれていません。しばらくお待ちください！",
            copy_to_clipboard: "をクリップボードにコピーしました",
            background: "背景画像",
            background_not_found: "背景画像なし",
            loginWarning:
                "Pixiv Extenderスクリプト警告！より快適にご利用いただくために、Pixivにログインしてください！ログインしないと、予期せぬバグが発生する可能性があります！",
            feed_illust_type_single: "[単一画像]",
            feed_illust_type_multiple: "[複数画像]",
            feed_illust_type_gif: "[Gif画像]",
            setting_title: "Pixiv Extender 設定",
            setting_MO: "PJAX対応(推奨)",
            setting_switchImgMulti: "複数の画像を自動的に読み込む",
            setting_switchImgSize: "画像のサイズを表示する",
            setting_switchImgPreload: "Gif・Zipの事前ダウンロード(通信量が増加します)",
            setting_downloadName: "ダウンロードファイル名：",
            setting_name_description:
                "{pid}は作品ID | {uid}はアーティストID\\n{pname}は作品名 | {uname}はアーティスト名\\n複数の画像の場合、インデックス番号は自動的に入力されます。\\n現在のところ、GIFと複数画像のリネームのみがサポートされています。",
            setting_general: "一般設定",
            setting_feedPage: "フィードページ設定",
            setting_artworkPage: "作品ページ設定",
            setting_download: "ダウンロード設定",
            setting_help_btn_tooltip: "この項目のヘルプ",
            setting_save_btn: "保存",
            setting_reset_btn: "リセット",
            setting_reset_confirm: "本当に設定をリセットしますか？",
        },
        en: {
            load_origin: "Load original images",
            ad_disable: "Remove ads",
            search_enhance: "Enhanced search",
            download_able: "Download multiple page artworks or GIF artworks",
            artist_info: "Display artist UIDs and profile background images",
            comment_load: "Automatically load comments",
            artwork_tag: "Display artwork types",
            redirect_cancel: "Avoid redirect links",
            history_enhance: "Enhanced History",
            watchlist: "Add to Watchlist",
            favorites: "favorites",
            search_help_title: "Search enhancement help",
            search_help_body:
                "<ui><li><code>fav:[number]</code>: Search for <code>[number]users入り</code></li><li><code>fav:[Number 1]-[Number 2]</code>: Search for <code>users入り</code> from [Number 1] to [Number 2] in the list below</li><li>Numerical list of <code>users入り</code><br>5, 10, 30, 50, 100, 200, 250, 300, 500, 800, 1000, 3000, 5000, 7500, 10000, 30000, 50000, 100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000</li><li><code>uid:[User ID]</code>: Go to the profile page of [User ID]</li><li><code>uname:[username]</code>: Search for users by [username]</li><li><code>pid:[artwork ID]</code>: Go to the work page for [artwork ID]</li></ui>",
            search_fav_err:
                'Please enter the correct "users入り" value. For more information, please refer to the help by clicking the "?" button on the right side of the search box.',
            illegal: "illegal",
            download: "download",
            download_wait: "please wait download completed",
            gif_not_loaded: "Gif not yet loaded, please wait a moment!",
            copy_to_clipboard: "copy to Clipboard",
            background: "background",
            background_not_found: "no-background",
            loginWarning:
                "Pixiv Extender Script Warning! Please login to Pixiv for a better experience! Failure to login may result in unpredictable bugs!",
            feed_illust_type_single: "[single pic]",
            feed_illust_type_multiple: "[multiple pic]",
            feed_illust_type_gif: "[gif pic]",
            setting_title: "Pixiv Extender Settings",
            setting_MO: "PJAX compliant(recommended)",
            setting_switchImgMulti: "Automatically load multiple images",
            setting_switchImgSize: "Display image size",
            setting_switchImgPreload: "Advance download of Gif/Zip (will increase traffic)",
            setting_downloadName: "Download file name: ",
            setting_name_description:
                "{pid} is the artwork ID | {uid} is the artist ID\\n{pname} is the name of the artwork | {uname} is the name of the artist\\nFor multiple images, the index number is automatically populated.\\nCurrently, only GIF and multi-image renaming are supported.",
            setting_general: "General Settings",
            setting_feedPage: "Feed Page Settings",
            setting_artworkPage: "Artwork Page Settings",
            setting_download: "Download Settings",
            setting_help_btn_tooltip: "Help for this item",
            setting_save_btn: "Save",
            setting_reset_btn: "Reset",
            setting_reset_confirm: "Do you really want to reset the settings?",
        },
        zh: {
            load_origin: "加载原图",
            ad_disable: "屏蔽广告",
            search_enhance: "搜索增强",
            download_able: "开启下载",
            artist_info: "显示作者信息",
            comment_load: "加载评论",
            artwork_tag: "作品标记",
            redirect_cancel: "取消重定向",
            history_enhance: "增强您的浏览历史记录",
            watchlist: "加入追更列表",
            favorites: "收藏人数",
            search_help_title: "搜索增强帮助",
            search_help_body:
                "<ui><li><code>fav:[number]</code>: Search for <code>[number]users入り</code></li><li><code>fav:[Number 1]-[Number 2]</code>: Search for <code>users入り</code> from [Number 1] to [Number 2] in the list below</li><li>Numerical list of <code>users入り</code><br>5, 10, 30, 50, 100, 200, 250, 300, 500, 800, 1000, 3000, 5000, 7500, 10000, 30000, 50000, 100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000</li><li><code>uid:[User ID]</code>: Go to the profile page of [User ID]</li><li><code>uname:[username]</code>: Search for users by [username]</li><li><code>pid:[artwork ID]</code>: Go to the work page for [artwork ID]</li></ui>",
            search_fav_err:
                "请输入正确的“users入り”号码。 如需了解更多信息，请点击搜索框右侧的“？”按钮查看帮助。",
            illegal: "不合法",
            download: "下载",
            download_wait: "请等待下载完成",
            gif_not_loaded: "Gif未加载完毕, 请稍等片刻!",
            copy_to_clipboard: "已复制到剪贴板",
            background: "背景图",
            background_not_found: "无背景图",
            loginWarning:
                "Pixiv Extender 脚本警告! 请登录Pixiv获得更好的体验! 未登录可能产生不可预料的bug!",
            feed_illust_type_single: "[单图]",
            feed_illust_type_multiple: "[多图]",
            feed_illust_type_gif: "[gif图]",
            setting_title: "Pixiv Extender配置",
            setting_MO: "兼容PJAX(推荐)",
            setting_switchImgMulti: "自动加载多图",
            setting_switchImgSize: "显示图片尺寸大小",
            setting_switchImgPreload: "预下载Gif、Zip(耗流量)",
            setting_downloadName: "下载文件名: ",
            setting_name_description:
                "{pid}是作品id | {uid}是画师id\\n{pname}是作品名 | {uname}是画师名\\n注意, 多图情况下, 会自动填充index索引编号\\n目前只支持GIF和多图的重命名",
            setting_general: "常规设置",
            setting_feedPage: "馈送页面设置",
            setting_artworkPage: "作品页面设置",
            setting_download: "下载设置",
            setting_help_btn_tooltip: "此项目的帮助",
            setting_save_btn: "保存設定",
            setting_reset_btn: "重置設定",
            setting_reset_confirm: "您真的想重置设置吗？",
        },
        "zh-cn": {},
        "zh-tw": {
            load_origin: "加載原圖",
            ad_disable: "屏蔽廣告",
            search_enhance: "搜索增強",
            download_able: "開啟下載",
            artist_info: "顯示作者信息",
            comment_load: "加載評論",
            artwork_tag: "作品標記",
            redirect_cancel: "取消重定向",
            history_enhance: "增強您的瀏覽記錄",
            watchlist: "加入追蹤列表",
            favorites: "收藏人數",
            search_help_title: "搜尋增強幫助",
            search_help_body:
                "<ui><li><code>fav:[number]</code>: Search for <code>[number]users入り</code></li><li><code>fav:[Number 1]-[Number 2]</code>: Search for <code>users入り</code> from [Number 1] to [Number 2] in the list below</li><li>Numerical list of <code>users入り</code><br>5, 10, 30, 50, 100, 200, 250, 300, 500, 800, 1000, 3000, 5000, 7500, 10000, 30000, 50000, 100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000</li><li><code>uid:[User ID]</code>: Go to the profile page of [User ID]</li><li><code>uname:[username]</code>: Search for users by [username]</li><li><code>pid:[artwork ID]</code>: Go to the work page for [artwork ID]</li></ui>",
            search_fav_err:
                "請輸入正確的“users入り”號碼。 如需了解更多信息，請點擊搜尋框右側的“？”按鈕查看協助。",
            illegal: "不合法",
            download: "下載",
            download_wait: "請等待下載完成",
            gif_not_loaded: "Gif未載入完畢, 請稍等片刻!",
            copy_to_clipboard: "已復製到剪貼板",
            background: "背景圖",
            background_not_found: "無背景圖",
            loginWarning:
                "Pixiv Extender 腳本警告! 請登錄Pixiv獲得更好的體驗! 未登錄可能產生不可預料的bug!",
            feed_illust_type_single: "[單圖]",
            feed_illust_type_multiple: "[多圖]",
            feed_illust_type_gif: "[gif圖]",
            setting_title: "Pixiv Extender配置",
            setting_MO: "相容PJAX(推薦)",
            setting_switchImgMulti: "自動載入多圖",
            setting_switchImgSize: "顯示圖片尺寸大小",
            setting_switchImgPreload: "預先下載Gif、Zip(耗流量)",
            setting_downloadName: "下載檔名: ",
            setting_name_description:
                "{pid}是作品id | {uid}是畫師id\\n{pname}是作品名 | {uname}是畫師名\\n注意, 多圖 情況下, 會自動填入index索引編號\\n目前只支援GIF和多圖的重命名",
            setting_general: "常規設定",
            setting_feedPage: "饋送頁面設定",
            setting_artworkPage: "作品頁面設定",
            setting_download: "下載設定",
            setting_help_btn_tooltip: "此項目的幫助",
            setting_save_btn: "儲存設定",
            setting_reset_btn: "重置設定",
            setting_reset_confirm: "您真的想重置設定嗎？",
        },
    };
    i18nLib["zh-cn"] = $.extend({}, i18nLib.zh);
    const i18n = (key) => i18nLib[lang][key] || `i18n[${lang}][${key}] not found`;

    const initConfig = () => {
        const settings = [
            ["ad_disable", true],
            ["search_enhance", true],
            ["download_able", true],
            ["artist_info", true],
            ["comment_load", true],
            ["artwork_tag", true],
            ["redirect_cancel", true],
            ["history_enhance", true],
            ["load_origin", true],
        ];
        const len = settings.length;
        for (let i = 0; i < len; i++) {
            const item = settings[i][0];
            settings[i][1] = GM_getValue(item);
            if (settings[i][1] === null || settings[i][1] === undefined) {
                GM_setValue(item, true);
                settings[i][1] = true;
            }
        }
        return Object.freeze({
            setting_panel: true,
            ad_disable: settings[0][1],
            search_enhance: settings[1][1],
            download_able: settings[2][1],
            artist_info: settings[3][1],
            comment_load: settings[4][1],
            artwork_tag: settings[5][1],
            redirect_cancel: settings[6][1],
            history_enhance: settings[7][1],
            load_origin: settings[8][1],
        });
    };
    const config = initConfig();

    // ============================ url 页面判断 ==============================
    const isArtworkPage = () => /.+artworks\/\d+.*/.test(location.href);
    const isMemberIndexPage = () => /.+\/users\/\d+.*/.test(location.href);
    const isMemberDynamicPage = () => /.+\/stacc.+/.test(location.href);
    const isHistoryPage = () => /.+history\.php.*/.test(location.href);

    // 判断是否登录
    if (!isLogin()) {
        alert(i18n("loginWarning"));
    }
    /**
     * [0] => 功能配置
     * [1] => ob / ob组[ob, ob创建函数，判断是否处于对应页面的函数(可选)]
     * [2] => 创建ob / ob组的函数
     * [3] => 判断是否处于对应页面的函数
     */
    const observers = [
        // 0. 設定パネル
        [
            "setting_panel",
            null,
            () => {
                observerFactory((mutations, observer) => {
                    for (let i = 0, len = mutations.length; i < len; i++) {
                        const mutation = mutations[i];
                        if (mutation.type !== "childList" || $("#pe-setting-btn").length > 0) {
                            continue;
                        }

                        // 親要素のスタイルを修正
                        $(".hHgbLu").css("grid-template-columns", "repeat(6, auto)");

                        $(mutation.target)
                            .find(".sc-1rlbh8f-1.kvBUoX")
                            .after(
                                $(
                                    `<button id="pe-setting-btn" type="button" title="${i18n(
                                        "setting_title"
                                    )}" class="iahZRV ekdKos"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="fill: currentColor; width: 20px;"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2023 Fonticons, Inc.--><path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/></svg></button>`
                                ).on("click", () => {
                                    let UICss;
                                    if ($(".charcoal-token").attr("data-theme") == "default") {
                                        // ライトテーマ
                                        UICss = `        body {overflow: hidden;}
        #pe-bg {position: fixed;z-index: 999999;background-color: rgba(0, 0, 0, 0.8);left: 0px;top: 0px;user-select: none;-moz-user-select: none;}
        #pe-fg {width: 50%;height: 82%;padding: 15px;position: absolute;top: 10%;left: 25%;background: #ffffff;border-radius: 20px;}
        #pe-fg * {margin: 7px 0;font-family: sans-serif;font-size: 15px;color: #111111;}
        #pe-fg h1 {font-size: 25px;font-weight: bold;}
        #pe-fg h2 {font-size: 20px;font-weight: bold;}
        #pe-close {position: absolute;right: 10px;top: 10px;width: 32px;height: 32px;cursor: pointer;fill: currentColor;}
        #pe-settings{height: 82%;overflow-y: scroll;}
        #pe-fg label.pe-toggle-box {display: block;width: fit-content;cursor: pointer;}
        #pe-fg label.pe-toggle-box * {margin: 0;}
        #pe-fg label.pe-toggle-box input {display: none;}
        #pe-fg label.pe-toggle-box input + div {display: inline-block;vertical-align: middle;margin-right: 10px;width: 50px;height: 24px;padding:2px;border-radius: 20px;background: #8a8a8a;position: relative;}
        #pe-fg label.pe-toggle-box input:checked + div {background: #0096fa;}
        #pe-fg label.pe-toggle-box input + div div {position: absolute;width: 24px;height: 24px;background: #ffffff;border-radius: 12px;top: 2px;left: 4%;transition: left 0.05s linear;}
        #pe-fg label.pe-toggle-box input:checked + div div {left: 52%;}
        #pe-fg label.pe-input-box input {width: 340px;height: 20px;border: 2px solid #8a8a8a;border-radius: 5px;padding: 5px;background: #ffffff;color: #000000;}
        #pe-fg button.pe-help-btn {background: #0096fa;color: #ffffff;font-size: 17.5px;border: none;border-radius: 25px;text-align: center;width: 25px;height: 25px;cursor: pointer;vertical-align: middle;}
        #pe-btns {display: flex;justify-content: center;}
        #pe-btns button#pe-save-btn, #pe-btns button#pe-reset-btn {font-size: 20px;width: 100px;height: 40px;border: none;border-radius: 10px;cursor: pointer;color: #ffffff;}
        #pe-btns button#pe-save-btn {background: #00b000;margin-right: 20px;}
        #pe-btns button#pe-reset-btn {background: #b00000;margin-left: 20px;}`;
                                    } else {
                                        // ダークテーマ
                                        UICss = `        body {overflow: hidden;}
        #pe-bg {position: fixed;z-index: 999999;background-color: rgba(0, 0, 0, 0.8);left: 0px;top: 0px;user-select: none;-moz-user-select: none;}
        #pe-fg {width: 50%;height: 82%;padding: 15px;position: absolute;top: 10%;left: 25%;background: #111111;border-radius: 20px;}
        #pe-fg * {margin: 7px 0;font-family: sans-serif;font-size: 15px;color: #ffffff;}
        #pe-fg h1 {font-size: 25px;font-weight: bold;}
        #pe-fg h2 {font-size: 20px;font-weight: bold;}
        #pe-close {position: absolute;right: 10px;top: 10px;width: 32px;height: 32px;cursor: pointer;fill: currentColor;}
        #pe-settings{height: 82%;overflow-y: scroll;}
        #pe-fg label.pe-toggle-box {display: block;width: fit-content;cursor: pointer;}
        #pe-fg label.pe-toggle-box * {margin: 0;}
        #pe-fg label.pe-toggle-box input {display: none;}
        #pe-fg label.pe-toggle-box input + div {display: inline-block;vertical-align: middle;margin-right: 10px;width: 50px;height: 24px;padding:2px;border-radius: 20px;background: #8a8a8a;position: relative;}
        #pe-fg label.pe-toggle-box input:checked + div {background: #0096fa;}
        #pe-fg label.pe-toggle-box input + div div {position: absolute;width: 24px;height: 24px;background: #ffffff;border-radius: 12px;top: 2px;left: 4%;transition: left 0.05s linear;}
        #pe-fg label.pe-toggle-box input:checked + div div {left: 52%;}
        #pe-fg label.pe-input-box input {width: 340px;height: 20px;border: 2px solid #8a8a8a;border-radius: 5px;padding: 5px;background: #ffffff;color: #000000;}
        #pe-fg button.pe-help-btn {background: #0096fa;color: #ffffff;font-size: 17.5px;border: none;border-radius: 25px;text-align: center;width: 25px;height: 25px;cursor: pointer;vertical-align: middle;}
        #pe-btns {display: flex;justify-content: center;}
        #pe-btns button#pe-save-btn, #pe-btns button#pe-reset-btn {font-size: 20px;width: 100px;height: 40px;border: none;border-radius: 10px;cursor: pointer;color: #ffffff;}
        #pe-btns button#pe-save-btn {background: #00b000;margin-right: 20px;}
        #pe-btns button#pe-reset-btn {background: #b00000;margin-left: 20px;}`;
                                    }

                                    $("body").append(`<div id="pe-bg">
    <div id="pe-fg">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" id="pe-close"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. -->
            <path d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c-9.4 9.4-9.4 24.6 0 33.9l47 47-47 47c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l47-47 47 47c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-47-47 47-47c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-47 47-47-47c-9.4-9.4-24.6-9.4-33.9 0z"></path>
        </svg>
        <h1>${i18n("setting_title")}</h1>
        <div id="pe-settings">
            
            <h2>${i18n("setting_general")}</h2>
            <label class="pe-toggle-box"><input type="checkbox" name="${
                GMkeys.MO
            }" /><div><div></div></div>${i18n("setting_MO")}</label>
            <label class="pe-toggle-box"><input type="checkbox" name="ad_disable" /><div><div></div></div>${i18n(
                "ad_disable"
            )}</label>
            <label class="pe-toggle-box"><input type="checkbox" name="search_enhance" /><div><div></div></div>${i18n(
                "search_enhance"
            )}</label>
            <label class="pe-toggle-box"><input type="checkbox" name="artist_info" /><div><div></div></div>${i18n(
                "artist_info"
            )}</label>
            <label class="pe-toggle-box"><input type="checkbox" name="redirect_cancel" /><div><div></div></div>${i18n(
                "redirect_cancel"
            )}</label>
            <label class="pe-toggle-box"><input type="checkbox" name="history_enhance" /><div><div></div></div>${i18n(
                "history_enhance"
            )}</label>
            <h2>${i18n("setting_feedPage")}</h2>
            <label class="pe-toggle-box"><input type="checkbox" name="artwork_tag" /><div><div></div></div>${i18n(
                "artwork_tag"
            )}</label>
            <h2>${i18n("setting_artworkPage")}</h2>
            <label class="pe-toggle-box"><input type="checkbox" name="load_origin" /><div><div></div></div>${i18n(
                "load_origin"
            )}</label>
            <label class="pe-toggle-box"><input type="checkbox" name="${
                GMkeys.switchImgSize
            }" /><div><div></div></div>${i18n("setting_switchImgSize")}</label>
            <label class="pe-toggle-box"><input type="checkbox" name="${
                GMkeys.switchImgMulti
            }" /><div><div></div></div>${i18n("setting_switchImgMulti")}</label>
            <label class="pe-toggle-box"><input type="checkbox" name="comment_load" /><div><div></div></div>${i18n(
                "comment_load"
            )}</label>
            <h2>${i18n("setting_download")}</h2>
            <label class="pe-toggle-box"><input type="checkbox" name="download_able" /><div><div></div></div>${i18n(
                "download_able"
            )}</label>
            <label class="pe-toggle-box"><input type="checkbox" name="${
                GMkeys.switchImgPreload
            }" /><div><div></div></div>${i18n("setting_switchImgPreload")}</label>
            <label class="pe-input-box">${i18n("setting_downloadName")}<input type="text" name="${
                                        GMkeys.downloadName
                                    }" placeholder="{pid}" /></label>
            <button type="button" title="${i18n(
                "setting_help_btn_tooltip"
            )}" class="pe-help-btn" onclick="alert('${i18n(
                                        "setting_name_description"
                                    )}')">?</button>
        </div>
        <div id="pe-btns">
            <button type="button" title="${i18n("setting_save_btn")}" id="pe-save-btn">${i18n(
                                        "setting_save_btn"
                                    )}</button>
            <button type="button" title="${i18n("setting_reset_btn")}" id="pe-reset-btn">${i18n(
                                        "setting_reset_btn"
                                    )}</button>
        </div>
    </div>
    <style>
        ${UICss}
    </style>
</div>`);
                                    $("#pe-bg").css({
                                        width: document.documentElement.clientWidth + "px",
                                        height: document.documentElement.clientHeight + "px",
                                    });
                                    let resizeTimer = null;
                                    $(window).on("resize", () => {
                                        if (resizeTimer != null) {
                                            clearTimeout(resizeTimer);
                                        }
                                        resizeTimer = setTimeout(() => {
                                            $("#pe-bg").css({
                                                width: document.documentElement.clientWidth + "px",
                                                height:
                                                    document.documentElement.clientHeight + "px",
                                            });
                                        }, 500);
                                    });
                                    $("#pe-close").click(function () {
                                        $("#pe-bg").remove();
                                    });

                                    $("#pe-fg")
                                        .find('input[type="checkbox"]')
                                        .each(function () {
                                            const $checkbox = $(this);
                                            const name = $checkbox.attr("name");
                                            GM.getValue(name, true).then((value) => {
                                                $checkbox.prop("checked", value);
                                            });
                                        });
                                    $("#pe-fg")
                                        .find('input[type="text"]')
                                        .each(function () {
                                            const $input = $(this);
                                            const name = $input.attr("name");
                                            GM.getValue(name).then((value) => {
                                                $input.val(value);
                                            });
                                        });

                                    $("#pe-fg")
                                        .find("#pe-save-btn")
                                        .on("click", () => {
                                            $("#pe-fg")
                                                .find('input[type="checkbox"]')
                                                .each(function () {
                                                    const $checkbox = $(this);
                                                    const name = $checkbox.attr("name");
                                                    const checked = $checkbox.prop("checked");
                                                    GM.setValue(name, checked);
                                                });
                                            $("#pe-fg")
                                                .find('input[type="text"]')
                                                .each(function () {
                                                    const $input = $(this);
                                                    const name = $input.attr("name");
                                                    GM.setValue(name, $input.val());
                                                });
                                            location.reload();
                                        });
                                    $("#pe-fg")
                                        .find("#pe-reset-btn")
                                        .on("click", () => {
                                            if (confirm(i18n("setting_reset_confirm"))) {
                                                GM.listValues().then((keys) => {
                                                    keys.forEach((key) => {
                                                        GM.deleteValue(key);
                                                    });
                                                    location.reload();
                                                });
                                            }
                                        });
                                })
                            );
                    }
                });
            },
            () => true,
        ],
        // 1. 広告・不要要素削除
        [
            "ad_disable",
            null,
            () => {
                GM_addStyle(`.premium-ad,/* 閲覧履歴ページのpremiumのバナー */
.cugra.sc-4nj1pr-4,
div.sc-jgyytr-1:nth-of-type(4),
div.sc-jgyytr-1:nth-of-type(3),
.csPOOw.sc-93qi7v-0,
#premium_noads,
.settingNavi p:nth-of-type(6),
.title > .trial,
iframe,
._premium-lead-promotion-banner,
a[href="/premium/lead/lp/?g=anchor&i=popular_works_list&p=popular&page=visitor"],
a[href="/premium/lead/lp/?g=anchor&i=work_detail_remove_ads"] {
    display: none !important;
}`);
            },
            () => true,
        ],
        // 2/3. 検索強化機能
        [
            "search_enhance",
            null,
            () =>
                observerFactory((mutations, observer) => {
                    for (let i = 0, len = mutations.length; i < len; i++) {
                        const mutation = mutations[i];
                        // 1. 判断是否改变节点, 或者是否有[form]节点
                        const $form = $(
                            '#js-mount-point-header form:not([action]), #root div[style="position: static; z-index: auto;"] form:not([action])'
                        );
                        if (mutation.type !== "childList" || !$form.length) {
                            continue;
                        }

                        // 2. 親要素のグリッドを調整
                        $form
                            .parent()
                            .parent()
                            .css(
                                "grid-template-columns",
                                "1fr minmax(0px, 528px) minmax(0px, 50px) 1fr"
                            );

                        (($form) => {
                            const label = i18n("favorites");
                            const numberList = [
                                "5",
                                "10",
                                "30",
                                "50",
                                "100",
                                "200",
                                "250",
                                "300",
                                "500",
                                "800",
                                "1000",
                                "3000",
                                "5000",
                                "7500",
                                "10000",
                                "30000",
                                "50000",
                                "100000",
                                "200000",
                                "300000",
                                "400000",
                                "500000",
                                "600000",
                                "700000",
                                "800000",
                            ];
                            const $input = $form.find('input[type="text"]:first');

                            $form.parent().after(
                                $(`<button type="button" title="${i18n(
                                    "search_help_title"
                                )}" class="iahZRV ekdKos">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="fill: currentColor; width: 20px;"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM169.8 165.3c7.9-22.3 29.1-37.3 52.8-37.3h58.3c34.9 0 63.1 28.3 63.1 63.1c0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6c-13.3 0-24-10.7-24-24V250.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1c0-8.4-6.8-15.1-15.1-15.1H222.6c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg></button>`).on(
                                    "click",
                                    () => {
                                        let UICss;
                                        if ($(".charcoal-token").attr("data-theme") == "default") {
                                            UICss = `        body {overflow: hidden;}
        #pe-bg {position: fixed;z-index: 999999;background-color: rgba(0, 0, 0, 0.8);left: 0px;top: 0px;-moz-user-select: none;user-select: none;}
        #pe-fg {width: 50%;height: 80%;padding: 15px;position: absolute;top: 10%;left: 25%;background: #ffffff;border-radius: 20px;overflow-y: scroll;}
        #pe-fg * {margin: 7px 0;font-family: sans-serif;font-size: 15px;color: #111111;}
        #pe-fg h1 {font-size: 25px;font-weight: bold;}
        #pe-close {position: absolute;right: 10px;top: 10px;width: 32px;height: 32px;cursor: pointer;fill: currentColor;}`;
                                        } else {
                                            UICss = `        body {overflow: hidden;}
        #pe-bg {position: fixed;z-index: 999999;background-color: rgba(0, 0, 0, 0.8);left: 0px;top: 0px;-moz-user-select: none;user-select: none;}
        #pe-fg {width: 50%;height: 80%;padding: 15px;position: absolute;top: 10%;left: 25%;background: #111111;border-radius: 20px;overflow-y: scroll;}
        #pe-fg * {margin: 7px 0;font-family: sans-serif;font-size: 15px;color: #ffffff;}
        #pe-fg h1 {font-size: 25px;font-weight: bold;}
        #pe-close {position: absolute;right: 10px;top: 10px;width: 32px;height: 32px;cursor: pointer;fill: currentColor;}`;
                                        }
                                        $("#pe-bg").remove();
                                        $("body").append(
                                            $(`<div id="pe-bg">
    <div id="pe-fg">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" id="pe-close"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. -->
            <path d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c-9.4 9.4-9.4 24.6 0 33.9l47 47-47 47c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l47-47 47 47c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-47-47 47-47c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-47 47-47-47c-9.4-9.4-24.6-9.4-33.9 0z"></path>
        </svg>
        <h1>${i18n("search_help_title")}</h1>
        <div>${i18n("search_help_body")}</div>
    </div>
    <style>
        ${UICss}
    </style>
</div>`)
                                        );
                                        $("#pe-bg").css({
                                            width: document.documentElement.clientWidth + "px",
                                            height: document.documentElement.clientHeight + "px",
                                        });
                                        let resizeTimer = null;
                                        $(window).on("resize", () => {
                                            if (resizeTimer != null) {
                                                clearTimeout(resizeTimer);
                                            }
                                            resizeTimer = setTimeout(() => {
                                                $("#pe-bg").css({
                                                    width:
                                                        document.documentElement.clientWidth + "px",
                                                    height:
                                                        document.documentElement.clientHeight +
                                                        "px",
                                                });
                                            }, 500);
                                        });
                                        $("#pe-close").click(function () {
                                            $("#pe-bg").remove();
                                        });
                                    }
                                )
                            );

                            $input.on("focus", () => {
                                setTimeout(() => {
                                    // users入り複数指定を置き換え
                                    let match = $input
                                        .val()
                                        .match(/(.+?)\s\((\d+)users入り .+? (\d+)users入り\)/);
                                    if (match) {
                                        $input.val(`${match[1]} fav:${match[2]}-${match[3]}`);
                                        return;
                                    }

                                    // users入り単独指定を置き換え
                                    match = $input.val().match(/(.+?)\s(\d+)users入り/);
                                    if (match) {
                                        $input.val(`${match[1]} fav:${match[2]}`);
                                        return;
                                    }

                                    // ユーザー検索ページで置き換え
                                    if (/.+\/search_user\.php.*/.test(location.href)) {
                                        if (
                                            !/uname:.+/.test(
                                                $input.val() && $input.val() != "uname:"
                                            )
                                        ) {
                                            // 置き換えされていない場合
                                            $input.val(`uname(p):${$input.val()}`);
                                        }
                                    }
                                }, 1000);
                            });

                            $form.on("submit", (e) => {
                                e.preventDefault();
                                e.stopImmediatePropagation();

                                let match = $input.val().match(/(.+?)\sfav:(\d+)$/);
                                if (match) {
                                    const index = numberList.indexOf(match[2]);
                                    if (index != -1) {
                                        if (/.{0,}tags\/.*?\/artworks.{0,}/g.test(location.href)) {
                                            location.href = location.href.replace(
                                                /tags\/(.*?)\/artworks/g,
                                                `tags/${encodeURIComponent(
                                                    `${match[1]} ${numberList[index]}users入り`
                                                )}/artworks`
                                            );
                                        } else {
                                            location.href = `https://www.pixiv.net/tags/${encodeURIComponent(
                                                `${match[1]} ${numberList[index]}users入り`
                                            )}/artworks?s_mode=s_tag`;
                                        }
                                        return;
                                    }
                                }

                                match = $input.val().match(/(.+?)\sfav:(\d+)-(\d+)/);
                                if (match) {
                                    const fromIndex = numberList.indexOf(match[2]);
                                    const toIndex = numberList.indexOf(match[3]);
                                    if (fromIndex != -1 && toIndex != -1) {
                                        let favorites;
                                        if (fromIndex < toIndex) {
                                            favorites = `(${numberList[fromIndex]}users入り`;
                                            for (let i = fromIndex + 1; i < toIndex; i++) {
                                                favorites += ` OR ${numberList[i]}users入り`;
                                            }
                                            favorites += ` OR ${numberList[toIndex]}users入り)`;
                                        } else {
                                            favorites = `(${numberList[toIndex]}users入り`;
                                            for (let i = toIndex + 1; i < fromIndex; i++) {
                                                favorites += ` OR ${numberList[i]}users入り`;
                                            }
                                            favorites += ` OR ${numberList[fromIndex]}users入り)`;
                                        }
                                        if (/.{0,}tags\/.*?\/artworks.{0,}/g.test(location.href)) {
                                            location.href = location.href.replace(
                                                /tags\/(.*?)\/artworks/g,
                                                `tags/${encodeURIComponent(
                                                    `${match[1]} ${favorites}`
                                                )}/artworks`
                                            );
                                        } else {
                                            location.href = `https://www.pixiv.net/tags/${encodeURIComponent(
                                                `${match[1]} ${favorites}`
                                            )}/artworks?s_mode=s_tag`;
                                        }
                                        return;
                                    }
                                }

                                // uidで検索
                                match = $input.val().match(/uid:(\d+)/);
                                if (match) {
                                    location.href = `https://www.pixiv.net/users/${match[1]}`;
                                    return;
                                }

                                // 作者名で検索
                                match = $input.val().match(/uname:(.*)/);
                                if (match) {
                                    location.href = `https://www.pixiv.net/search_user.php?s_mode=s_usr&nick=${match[1]}`;
                                    return;
                                }

                                // pidで検索
                                match = $input.val().match(/pid:(\d+)/);
                                if (match) {
                                    location.href = `https://www.pixiv.net/artworks/${match[1]}`;
                                    return;
                                }

                                if (!!$input.val()) {
                                    // 通常検索
                                    if (/.{0,}tags\/.*?\/artworks.{0,}/g.test(location.href)) {
                                        location.href = location.href.replace(
                                            /tags\/(.*?)\/artworks/g,
                                            `tags/${encodeURIComponent($input.val())}/artworks`
                                        );
                                    } else {
                                        location.href = `https://www.pixiv.net/tags/${encodeURIComponent(
                                            $input.val()
                                        )}/artworks?s_mode=s_tag`;
                                    }
                                    return;
                                }
                            });
                        })($form);

                        observer.disconnect();
                        break;
                    }
                }),
            () => true,
        ],
        // 4. 单张图片替换为原图格式. 追加下载按钮, 下载gif图、gif的帧压缩包、多图
        [
            "download_able",
            null,
            async () => {
                // 1. 初始化方法
                const initDownloadBtn = (option) => {
                    // 下载按钮, 复制分享按钮并旋转180度
                    const options = $.extend(
                        {
                            $shareButtonContainer: undefined,
                            id: "",
                            text: "",
                            clickFun: () => {},
                        },
                        option
                    );
                    const $downloadButtonContainer = options.$shareButtonContainer.clone();
                    $downloadButtonContainer
                        .addClass("pe-download-btn")
                        .attr("id", options.id)
                        .removeClass(options.$shareButtonContainer.attr("class"))
                        .css("margin-right", "10px")
                        .css("position", "relative")
                        .css("border", "1px solid")
                        .css("padding", "1px 10px")
                        .append(`<p style="display: inline">${options.text}</p>`);
                    $downloadButtonContainer
                        .find("button")
                        .css("transform", "rotate(180deg)")
                        .on("click", options.clickFun);
                    options.$shareButtonContainer.after($downloadButtonContainer);
                    return $downloadButtonContainer;
                };
                // 单图显示图片尺寸 https://www.pixiv.net/artworks/109953681
                // TODO 多图显示图片尺寸异常 https://www.pixiv.net/artworks/65424837
                const addImgSize = async (option) => {
                    // 从 $img 获取图片大小, after 到 $img
                    const options = $.extend(
                        {
                            $img: undefined,
                            position: "absolute",
                        },
                        option
                    );
                    const $img = options.$img;
                    const position = options.position;
                    if ($img.length !== 1) {
                        return;
                    }
                    GM.getValue(GMkeys.switchImgSize, true).then((open) => {
                        if (!!open) {
                            // 1. 找到 显示图片大小 的 span, 没有则添加
                            let $span = $img.next("span");
                            if ($span.length <= 0) {
                                // 添加前 去除失去依赖的 span
                                $("body")
                                    .find(".pe-img-size")
                                    .each(function () {
                                        const $this = $(this);
                                        const $prev = $this.prev("canvas, img");
                                        if ($prev.length <= 0) {
                                            $this.remove();
                                        }
                                    });
                                $img.after(`<span class="pe-img-size" style="position: ${position}; right: 0; top: 28px;
                    color: #ffffff; font-size: x-large; font-weight: bold; -webkit-text-stroke: 1.0px #000000;"></span>`);
                                $span = $img.next("span");
                            }
                            // 2. 根据标签获取图片大小, 目前只有 canvas 和 img 两种
                            if ($img.prop("tagName") === "IMG") {
                                const img = new Image();
                                img.src = $img.attr("src");
                                img.onload = function () {
                                    $span.text(`${this.width}x${this.height}`);
                                };
                            } else {
                                const width =
                                    $img.attr("width") ||
                                    $img.css("width").replace("px", "") ||
                                    $img.css("max-width").replace("px", "") ||
                                    0;
                                const height =
                                    $img.attr("height") ||
                                    $img.css("height").replace("px", "") ||
                                    $img.css("max-height").replace("px", "") ||
                                    0;
                                $span.text(`${width}x${height}`);
                            }
                        }
                    });
                };
                const mimeType = (suffix) => {
                    const lib = {
                        png: "image/png",
                        jpg: "image/jpeg",
                        gif: "image/gif",
                    };
                    return lib[suffix] || `mimeType[${suffix}] not found`;
                };
                const getDownloadName = (name) => {
                    if (name == "") {
                        return illust().illustId;
                    }
                    return name
                        .replace("{pid}", illust().illustId)
                        .replace("{uid}", illust().userId)
                        .replace("{pname}", illust().illustTitle)
                        .replace("{uname}", illust().userName);
                };
                const isMoreMode = () => illust().pageCount > 1;
                const isGifMode = () => illust().illustType === 2;
                const isSingleMode = () =>
                    (illust().illustType === 0 || illust().illustType === 1) &&
                    illust().pageCount === 1;
                const selectorShareBtn = await GM.getValue(GMkeys.selectorShareBtn, ".bTImJG"); // section 下的 div

                // 热修复下载按钮的className
                const a = () =>
                    observerFactory((mutations, observer) => {
                        for (let i = 0, len = mutations.length; i < len; i++) {
                            const mutation = mutations[i];
                            const $target = $(mutation.target);
                            if ($target.prop("tagName").toLowerCase() !== "section") continue;
                            const $section = $target.find("section");
                            if ($section.length <= 0) continue;
                            const className = $section
                                .eq(0)
                                .children("div")
                                .eq(1)
                                .attr("class")
                                .split(" ")[1];
                            GM.setValue(GMkeys.selectorShareBtn, `.${className}`);
                            observer.disconnect();
                            return;
                        }
                    });
                // 显示单图、多图原图
                const b = () =>
                    observerFactory({
                        callback(mutations, observer) {
                            for (let i = 0, len = mutations.length; i < len; i++) {
                                const mutation = mutations[i];
                                const $target = $(mutation.target);
                                const replaceImg = ($target, attr, value) => {
                                    const oldValue = $target.attr(attr);
                                    if (
                                        new RegExp(
                                            `https?://i(-f|-cf)?\.pximg\.net.*\/${illust().id}_.*`
                                        ).test(oldValue) &&
                                        !new RegExp(
                                            `https?://i(-f|-cf)?\.pximg\.net/img-original.*`
                                        ).test(oldValue)
                                    ) {
                                        $target.attr(attr, value).css("filter", "none");
                                        $target.fitWindow();
                                    }
                                };

                                // 1. 单图、多图 DOM 结构都为 <a href=""><img/></a>
                                const $link = $target.find("img[src]");
                                $link.each(function () {
                                    const $this = $(this);
                                    const href = $this.parent("a").attr("href");
                                    if (!!href && (href.endsWith("jpg") || href.endsWith("png"))) {
                                        if (config.load_origin) {
                                            replaceImg($this, "src", href);
                                        }
                                        addImgSize({ $img: $this }); // 显示图片大小
                                    }
                                });

                                // 2. 移除马赛克遮罩, https://www.pixiv.net/member_illust.php?mode=medium&illust_id=50358638
                                // $('.e2p8rxc2').hide(); // 懒得适配了, 自行去个人资料设置 https://www.pixiv.net/setting_user.php
                            }
                        },
                        option: {
                            attributes: true,
                            childList: true,
                            subtree: true,
                            attributeFilter: ["src", "href"],
                        },
                    });
                // 下载动图帧zip, gif图
                const c = () =>
                    observerFactory((mutations, observer) => {
                        for (let i = 0, len = mutations.length; i < len; i++) {
                            const mutation = mutations[i];
                            const $target = $(mutation.target);

                            // 1. 单图、多图、gif图三种模式
                            const $shareBtn = $target.find(selectorShareBtn);

                            const $canvas = $target.find("canvas");
                            // 2. 显示图片大小
                            addImgSize({ $img: $canvas });
                            if (
                                !isGifMode() ||
                                mutation.type !== "childList" ||
                                $shareBtn.length <= 0 ||
                                $target.find("#pe-download-zip").length > 0
                            ) {
                                continue;
                            }

                            // 3. 初始化 下载按钮
                            const $zipBtn = initDownloadBtn({
                                $shareButtonContainer: $shareBtn,
                                id: "pe-download-zip",
                                text: "zip",
                            });
                            const $gifBtn = initDownloadBtn({
                                $shareButtonContainer: $shareBtn,
                                id: "pe-download-gif",
                                text: "gif",
                                clickFun() {
                                    // 从 pixiv 官方 api 获取 gif 的数据
                                    $.ajax({
                                        url: `/ajax/illust/${illust().illustId}/ugoira_meta`,
                                        dataType: "json",
                                        success: ({ body }) => {
                                            // 1. 初始化 gif 下载按钮 点击事件
                                            // GIF_worker_URL 来自 https://greasyfork.org/scripts/2963-gif-js/code/gifjs.js?version=8596
                                            let gifUrl;

                                            const gifFrames = [];
                                            const gifFactory = new GIF({
                                                workers: 1,
                                                quality: 10,
                                                workerScript: GIF_worker_URL,
                                            });

                                            for (
                                                let frameIdx = 0,
                                                    frames = body.frames,
                                                    framesLen = frames.length;
                                                frameIdx < framesLen;
                                                frameIdx++
                                            ) {
                                                const frame = frames[frameIdx];
                                                const url = illust().urls.original.replace(
                                                    "ugoira0.",
                                                    `ugoira${frameIdx}.`
                                                );
                                                GM.xmlHttpRequest({
                                                    method: "GET",
                                                    url,
                                                    headers: {
                                                        referer: "https://www.pixiv.net/",
                                                    },
                                                    overrideMimeType:
                                                        "text/plain; charset=x-user-defined",
                                                    onload({ responseText }) {
                                                        // 2. 转为blob类型
                                                        const r = responseText;

                                                        const data = new Uint8Array(r.length);
                                                        let i = 0;
                                                        while (i < r.length) {
                                                            data[i] = r.charCodeAt(i);
                                                            i++;
                                                        }
                                                        const suffix = url.split(".").splice(-1);
                                                        const blob = new Blob([data], {
                                                            type: mimeType(suffix),
                                                        });

                                                        // 3. 压入gifFrames数组中, 手动同步sync
                                                        const img = document.createElement("img");
                                                        img.src = URL.createObjectURL(blob);
                                                        img.width = illust().width;
                                                        img.height = illust().height;
                                                        img.onload = () => {
                                                            gifFrames[frameIdx] = {
                                                                frame: img,
                                                                option: {
                                                                    delay: frame.delay,
                                                                },
                                                            };
                                                            if (
                                                                Object.keys(gifFrames).length >=
                                                                framesLen
                                                            ) {
                                                                $.each(gifFrames, (i, f) =>
                                                                    gifFactory.addFrame(
                                                                        f.frame,
                                                                        f.option
                                                                    )
                                                                );
                                                                gifFactory.render();
                                                            }
                                                        };
                                                    },
                                                });
                                            }
                                            gifFactory.on("progress", (pct) => {
                                                $gifBtn
                                                    .find("p")
                                                    .text(`gif ${parseInt(pct * 100)}%`);
                                            });
                                            gifFactory.on("finished", (blob) => {
                                                gifUrl = URL.createObjectURL(blob);
                                                GM.getValue(GMkeys.downloadName, `{pid}`).then(
                                                    (name) => {
                                                        const $a = $(
                                                            `<a href="${gifUrl}" download="${getDownloadName(
                                                                name
                                                            )}"></a>`
                                                        );
                                                        $gifBtn.find("button").wrap($a);
                                                    }
                                                );
                                            });
                                            $gifBtn
                                                .find("button")
                                                .off("click")
                                                .on("click", () => {
                                                    if (!gifUrl) {
                                                        alert(i18n("gif_not_loaded"));
                                                        return;
                                                    }
                                                    // Adblock 禁止直接打开 blob url, https://github.com/jnordberg/gif.js/issues/71#issuecomment-367260284
                                                    // window.open(gifUrl);
                                                });
                                        },
                                    });
                                },
                            });

                            // 4. 控制是否预下载, 避免多个页面导致爆内存, 直接下载 zip
                            $.ajax({
                                url: `/ajax/illust/${illust().illustId}/ugoira_meta`,
                                dataType: "json",
                                success: ({ body }) => {
                                    GM.getValue(GMkeys.downloadName, `{pid}`).then((name) => {
                                        const $a = $(
                                            `<a href="${
                                                body.originalSrc
                                            }" download="${getDownloadName(name)}"></a>`
                                        );
                                        $zipBtn.find("button").wrap($a);
                                    });
                                },
                            });
                            GM.getValue(GMkeys.switchImgPreload, true).then((open) => {
                                if (open) {
                                    $gifBtn.find("button").click();
                                }
                            });

                            // 5. 取消监听
                            GM.getValue(GMkeys.MO, true).then((v) => {
                                if (!v) observer.disconnect();
                            });
                        }
                    });
                // 下载多图zip
                const d = () =>
                    observerFactory((mutations, observer) => {
                        for (let i = 0, len = mutations.length; i < len; i++) {
                            const mutation = mutations[i];
                            const $target = $(mutation.target);

                            // 1. 单图、多图、gif图三种模式
                            const $shareBtn = $target.find(selectorShareBtn);
                            if (
                                !isMoreMode() ||
                                mutation.type !== "childList" ||
                                !$shareBtn.length ||
                                !!$target.find("#pe-download-zip").length
                            ) {
                                continue;
                            }

                            // 2. 查看全部图片
                            GM.getValue(GMkeys.switchImgMulti, true).then((open) => {
                                if (open) {
                                    $shareBtn.parent("section").next("button").click();
                                }
                            });

                            // 3. 初始化 图片数量, 图片url
                            const zip = new JSZip();
                            let downloaded = 0; // 下载完成数量
                            const num = illust().pageCount; // 下载目标数量
                            const url = illust().urls.original;
                            const imgUrls = Array(parseInt(num))
                                .fill()
                                .map((value, index) => url.replace(/_p\d\./, `_p${index}.`));

                            // 4. 初始化 下载按钮, 复制分享按钮并旋转180度
                            const $zipBtn = initDownloadBtn({
                                $shareButtonContainer: $shareBtn,
                                id: "pe-download-zip",
                                text: `${i18n("download")}`,
                                clickFun() {
                                    // 3.1. 下载图片, https://wiki.greasespot.net/GM.xmlHttpRequest
                                    if ($(this).attr("start") !== "true") {
                                        $(this).attr("start", true);
                                        $.each(imgUrls, (index, url) => {
                                            GM.xmlHttpRequest({
                                                method: "GET",
                                                url,
                                                headers: {
                                                    referer: "https://www.pixiv.net/",
                                                },
                                                overrideMimeType:
                                                    "text/plain; charset=x-user-defined",
                                                onload({ responseText }) {
                                                    // 4.1. 转为blob类型
                                                    const r = responseText;

                                                    const data = new Uint8Array(r.length);
                                                    let i = 0;
                                                    while (i < r.length) {
                                                        data[i] = r.charCodeAt(i);
                                                        i++;
                                                    }
                                                    const suffix = url.split(".").splice(-1);
                                                    const blob = new Blob([data], {
                                                        type: mimeType(suffix),
                                                    });

                                                    // 4.2. 压缩图片
                                                    GM.getValue(GMkeys.downloadName, `{pid}`).then(
                                                        (name) => {
                                                            zip.file(
                                                                `${getDownloadName(
                                                                    name
                                                                )}_${index}.${suffix}`,
                                                                blob,
                                                                { binary: true }
                                                            );
                                                        }
                                                    );

                                                    // 4.3. 手动sync, 避免下载不完全的情况
                                                    downloaded++;
                                                    $zipBtn
                                                        .find("p")
                                                        .html(
                                                            `${i18n(
                                                                "download"
                                                            )}${downloaded}/${num}`
                                                        );
                                                },
                                            });
                                        });
                                        return;
                                    }

                                    // 3.2. 手动sync, 避免下载不完全
                                    if (downloaded < num) {
                                        alert(i18n("download_wait"));
                                        return;
                                    }
                                    // 3.3. 使用jszip.js和FileSaver.js压缩并下载图片
                                    GM.getValue(GMkeys.downloadName, `{pid}`).then((name) => {
                                        zip.generateAsync({
                                            type: "blob",
                                            base64: true,
                                        }).then((content) =>
                                            saveAs(content, getDownloadName(name))
                                        );
                                    });
                                },
                            });

                            // 4. 控制是否预下载, 避免多个页面导致爆内存
                            GM.getValue(GMkeys.switchImgPreload, true).then((open) => {
                                if (open) {
                                    $zipBtn.find("button").click();
                                }
                            });

                            // 5. 取消监听
                            GM.getValue(GMkeys.MO, true).then((v) => {
                                if (!v) observer.disconnect();
                            });
                        }
                    });

                // 这里的页面判断可以去除, 判断在第1次就结束了
                return [
                    [a(), a],
                    [b(), b],
                    [c(), c],
                    [d(), d],
                ];
            },
            () => isArtworkPage(),
        ],
        // 5. 在画师页面和作品页面显示画师id、画师背景图, 用户头像允许右键保存
        [
            "artist_info",
            null,
            () => {
                // 画师页面UI
                const a = () =>
                    observerFactory((mutations, observer) => {
                        for (let i = 0, len = mutations.length; i < len; i++) {
                            const mutation = mutations[i];

                            // 1. 判断是否改变节点, 或者是否有[section]节点
                            const $target = $(mutation.target); // 多个反混淆externalLinksContainer

                            const externalLinksContainer = "_2AOtfl9";
                            const $row = $(`ul.${externalLinksContainer}`).parent();
                            if (
                                mutation.type !== "childList" ||
                                $row.length <= 0 ||
                                $("body").find("#uid").length > 0
                            ) {
                                continue;
                            }

                            // 1. 添加新的一行的div
                            const $peRow = $row.clone();

                            const $ul = $peRow.children("ul");
                            $peRow.children(":not(ul)").remove();
                            $ul.empty();
                            $row.before($peRow);

                            // 2. 显示画师id, 点击自动复制到剪贴板
                            const uid = getUid();
                            const $uid = $(
                                `<li id="uid"><div style="font-size: 20px;font-weight: 700;color: #333;margin-right: 8px;line-height: 1">UID:${uid}</div></li>`
                            ).on("click", function () {
                                const $this = $(this);
                                $this.html(`<span>UID${i18n("copy_to_clipboard")}</span>`);
                                GM.setClipboard(uid);
                                setTimeout(() => {
                                    $this.html(`<span>UID${uid}</span>`);
                                }, 2000);
                            });
                            $ul.append($uid);

                            // 3. 显示画师背景图
                            const background = preloadData.user[uid].background;
                            const url = (background && background.url) || "";
                            const $bgli = $(
                                '<li><div style="font-size: 20px;font-weight: 700;color: #333;margin-right: 8px;line-height: 1"></div></li>'
                            );
                            const $bg = $bgli.find("div");
                            if (!!url && url !== "none") {
                                $bg.append(
                                    `<img src="${url}" width="30px"><a target="_blank" href="${url}">${i18n(
                                        "background"
                                    )}</a>`
                                );
                            } else {
                                $bg.append(`<span>${i18n("background_not_found")}</span>`);
                            }
                            $ul.append($bgli);

                            // 4. 取消监听
                            GM.getValue(GMkeys.MO, true).then((v) => {
                                if (!v) observer.disconnect();
                            });
                        }
                    });
                // 作品页面UI
                const b = () =>
                    observerFactory((mutations, observer) => {
                        for (let i = 0, len = mutations.length; i < len; i++) {
                            const mutation = mutations[i];
                            // 1. 判断是否改变节点, 或者是否有[section]节点
                            const $aside = $(mutation.target).parent().find("main").next("aside");
                            if (mutation.type !== "childList" || $aside.length <= 0) {
                                continue;
                            }

                            const $row = $aside.find("section:first").find("h2");
                            if ($row.length <= 0 || $aside.find("#pe-background").length > 0) {
                                continue;
                            }

                            // 2. 显示画师背景图
                            const uid = getUid();
                            const background = preloadData.user[uid].background;
                            const url = (background && background.url) || "";
                            const $bgDiv = $row.clone().attr("id", "pe-background");
                            $bgDiv.children("a").remove();
                            $bgDiv.children("div").children("div").remove();
                            $bgDiv.prepend(`<img src="${url}" width="10%"/>`);
                            $bgDiv
                                .find("div a")
                                .attr("href", !!url ? url : "javascript:void(0)")
                                .attr("target", "_blank")
                                .text(!!url ? i18n("background") : i18n("background_not_found"));
                            $row.after($bgDiv);

                            // 3. 显示画师id, 点击自动复制到剪贴板
                            const $uid = $row.clone();
                            $uid.children("a").remove();
                            $uid.children("div").children("div").remove();
                            $uid.find("a")
                                .attr("href", "javascript:void(0)")
                                .attr("id", "pe-uid")
                                .text(`UID: ${uid}`);
                            $uid.on("click", function () {
                                const $this = $(this);
                                $this.find("a").text(`UID${i18n("copy_to_clipboard")}`);
                                GM.setClipboard(uid);
                                setTimeout(() => {
                                    $this.find("a").text(`UID: ${uid}`);
                                }, 2000);
                            });
                            $bgDiv.after($uid);

                            // 4. 取消监听
                            GM.getValue(GMkeys.MO, true).then((v) => {
                                if (!v) observer.disconnect();
                            });
                        }
                    });
                // 解除 用户头像 的background 限制, 方便保存用户头像
                const c = () =>
                    observerFactory((mutations, observer) => {
                        for (let i = 0, len = mutations.length; i < len; i++) {
                            const mutation = mutations[i];
                            // 1. 判断是否改变节点
                            if (mutation.type !== "childList") {
                                continue;
                            }

                            // 2. 将作者头像由 background 转为 <img>
                            const $target = $(mutation.target);
                            $target.find('div[role="img"]').each(function () {
                                const $this = $(this);
                                const tagName = $this.prop("tagName");

                                const imgUrl = $this.getBackgroundUrl();
                                if (!imgUrl) {
                                    return;
                                }

                                const $userImg = $('<img class="pe-user-img" src=""/>').attr(
                                    "src",
                                    imgUrl
                                );
                                $userImg
                                    .css("width", $this.css("width"))
                                    .css("height", $this.css("height"));

                                // if(tagName.toLowerCase() === 'a') {
                                //     $this.html($userImg);
                                //     $this.css('background-image', '');
                                //     return;
                                // }

                                if (tagName.toLowerCase() === "div") {
                                    $userImg.attr("class", $this.attr("class"));
                                    $userImg.html($this.html());
                                    $this.replaceWith(() => $userImg);
                                    return;
                                }
                            });

                            // 3. 将评论头像由 background 转为 <img>
                            $target.find("a[data-user_id][data-src]").each(function () {
                                const $this = $(this);
                                const $div = $this.find("div");
                                const $img = $("<img/>");
                                $img.attr("src", $this.attr("data-src"));
                                if (!!$div.length) {
                                    $img.attr("class", $div.attr("class"))
                                        .css("width", $div.css("width"))
                                        .css("height", $div.css("height"));
                                    $this.html($img);
                                }
                            });
                        }
                    });
                return [
                    [a(), a, () => isMemberIndexPage()],
                    [b(), b, () => isArtworkPage()],
                    [c(), c, () => true],
                ];
            },
            () => true,
        ],
        // 6. 自动加载评论
        [
            "comment_load",
            null,
            () => {
                const skipButton = i18n("watchlist");
                const moreReplaySelector = "._28zR1MQ";
                return observerFactory((mutations, observer) => {
                    if (!open || !isArtworkPage()) {
                        return;
                    }
                    for (let i = 0, len = mutations.length; i < len; i++) {
                        const mutation = mutations[i];
                        // 1. 判断是否改变节点
                        if (mutation.type !== "childList") {
                            continue;
                        }

                        // 2. 模拟点击加载按钮
                        const $moreCommentBtns = $("div > div:eq(2) > div div[role='button']");
                        let $moreCommentBtn = $moreCommentBtns[0];

                        if ($moreCommentBtn) {
                            if ($moreCommentBtn.textContent === skipButton) {
                                if ($moreCommentBtns.length > 1) {
                                    $moreCommentBtn = $moreCommentBtns[1];
                                    $moreCommentBtn.click();
                                }
                            } else {
                                $moreCommentBtn.click();
                            }
                        }

                        const $moreReplayBtn = $(mutation.target).find(moreReplaySelector);
                        $moreReplayBtn.click();
                    }
                });
            },
            () => true,
        ],
        // 7. 对主页动态中的图片标记作品类型
        [
            "artwork_tag",
            null,
            () => {
                const illustTitleSelector = ".stacc_ref_illust_title";
                return observerFactory((mutations, observer) => {
                    for (let i = 0, len = mutations.length; i < len; i++) {
                        const mutation = mutations[i];
                        // 1. 判断是否改变节点
                        const $title = $(mutation.target).find(illustTitleSelector);
                        if (mutation.type !== "childList" || !$title.length) {
                            continue;
                        }

                        $title.each(function () {
                            const $a = $(this).find("a");
                            // 1. 已经添加过标记的就不再添加
                            if (!!$a.attr("pe-illust-id")) {
                                return;
                            }
                            // 2. 获取pid, 设置标记避免二次生成
                            const illustId = new URL(
                                `${location.origin}/${$a.attr("href")}`
                            ).searchParams.get("illust_id");
                            $a.attr("pe-illust-id", illustId);
                            // 3. 调用官方api, 判断作品类型
                            $.ajax({
                                url: `/ajax/illust/${illustId}`,
                                dataType: "json",
                                success: ({ body }) => {
                                    const illustType = parseInt(body.illustType);
                                    const isMultiPic = parseInt(body.pageCount) > 1;
                                    switch (illustType) {
                                        case 0:
                                        case 1:
                                            $a.after(
                                                `<p>${
                                                    isMultiPic
                                                        ? i18n("feed_illust_type_multiple")
                                                        : i18n("feed_illust_type_single")
                                                }</p>`
                                            );
                                            break;
                                        case 2:
                                            $a.after(`<p>${i18n("feed_illust_type_gif")}</p>`);
                                            break;
                                    }
                                },
                            });
                        });
                    }
                });
            },
            () => isMemberDynamicPage(),
        ],
        // 8. 对jump.php取消重定向
        [
            "redirect_cancel",
            null,
            () => {
                const jumpSelector = 'a[href*="jump.php"]';

                return observerFactory((mutations, observer) => {
                    for (let i = 0, len = mutations.length; i < len; i++) {
                        const mutation = mutations[i];
                        // 1. 判断是否改变节点
                        if (mutation.type !== "childList") {
                            continue;
                        }
                        // 2. 修改href
                        const $jump = $(mutation.target).find(jumpSelector);
                        $jump.each(function () {
                            const $this = $(this);
                            const url = $this.attr("href").match(/jump\.php\?(url=)?(.*)$/)[2];
                            $this.attr("href", decodeURIComponent(url));
                        });
                    }
                });
            },
            () => true,
        ],
        // 9. 閲覧履歴の強化
        [
            "history_enhance",
            null,
            () => {
                return observerFactory((mutations, observer) => {
                    for (let i = 0, len = mutations.length; i < len; i++) {
                        const mutation = mutations[i];
                        if (mutation.type !== "childList") {
                            continue;
                        }
                        $(mutation.target)
                            .find("span._history-item.trial")
                            .each(function () {
                                let url = /http.*?\.jpg/.exec($(this).attr("style"))[0];
                                let pid = /\/\d*?_/.exec(url)[0].slice(1, -1);
                                $(this)
                                    .removeClass("trial")
                                    .addClass("pe-history")
                                    .append(
                                        $(
                                            `<a href="/artworks/${pid}" target="_blank" style="display: block; width: 100%; height: 100%;"></a><div class="status"></div>`
                                        )
                                    );
                                const statusElm = $(this).find(".status");
                                $.ajax({
                                    url: `/ajax/illust/${pid}`,
                                    dataType: "json",
                                    success: ({ body }) => {
                                        if (body.likeData == "true") {
                                            statusElm.append(
                                                `<span><i class="_icon-20 _icon-smile"></i></span>`
                                            );
                                        }
                                        if (body.bookmarkData) {
                                            statusElm.append(
                                                `<span class="_bookmark-icon-like-icon-font white"></span>`
                                            );
                                        }
                                        const illustType = parseInt(body.illustType);
                                        const isMultiPic = parseInt(body.pageCount) > 1;
                                        switch (illustType) {
                                            case 0:
                                            case 1:
                                                statusElm.append(
                                                    `<span style="vertical-align: middle;color: #3f3f3f;">${
                                                        isMultiPic
                                                            ? i18n("feed_illust_type_multiple")
                                                            : i18n("feed_illust_type_single")
                                                    }</span>`
                                                );
                                                break;
                                            case 2:
                                                statusElm.append(
                                                    `<span style="vertical-align: middle;color: #3f3f3f;">${i18n(
                                                        "feed_illust_type_gif"
                                                    )}</span>`
                                                );
                                                break;
                                        }
                                    },
                                });
                            });
                        $(mutation.target)
                            .find("a._history-item:not(.pe-history)")
                            .each(function () {
                                let url = /http.*?\.jpg/.exec($(this).attr("style"))[0];
                                let pid = /\/\d*?_/.exec(url)[0].slice(1, -1);
                                const statusElm = $(this).find(".status");
                                $.ajax({
                                    url: `/ajax/illust/${pid}`,
                                    dataType: "json",
                                    success: ({ body }) => {
                                        const illustType = parseInt(body.illustType);
                                        const isMultiPic = parseInt(body.pageCount) > 1;
                                        switch (illustType) {
                                            case 0:
                                            case 1:
                                                statusElm.append(
                                                    `<span style="vertical-align: middle;color: #3f3f3f;">${
                                                        isMultiPic
                                                            ? i18n("feed_illust_type_multiple")
                                                            : i18n("feed_illust_type_single")
                                                    }</span>`
                                                );
                                                break;
                                            case 2:
                                                statusElm.append(
                                                    `<span style="vertical-align: middle;color: #3f3f3f;">${i18n(
                                                        "feed_illust_type_gif"
                                                    )}</span>`
                                                );
                                                break;
                                        }
                                    },
                                });
                                $(this)
                                    .addClass("pe-history")
                                    .on("click", function (e) {
                                        e.stopImmediatePropagation();
                                    });
                            });
                    }
                });
            },
            () => isHistoryPage(),
        ],
    ];
    const len = observers.length;
    // 初始化ob
    for (let i = 0; i < len; i++) {
        if (config[observers[i][0]] && observers[i][1] === null) {
            const _observer = observers[i][2]();
            // 有一个ob组特殊处理
            if (_observer instanceof Promise) {
                _observer.then((v) => (observers[i][1] = v));
            } else {
                observers[i][1] = _observer;
            }
        }
    }
    // 页面跳转不触发脚本重载时，用监听器关闭ob避免页面卡死和cpu占用飙升
    const onpushstate = history.onpushstate;
    history.onpushstate = () => {
        if (typeof onpushstate === "function") {
            onpushstate();
        }
        for (let i = 0; i < len; i++) {
            // 功能设置没开启，关闭对应ob
            if (!config[observers[i][0]]) {
                // ob已创建
                if (observers[i][1] !== null) {
                    // ob组处理
                    if (observers[i][1] instanceof Array) {
                        const _len = observers[i][1];
                        for (let j = 0; j < _len; j++) {
                            const v = observers[i][1][j];
                            if (v[0] !== null) {
                                v[0].disconnect();
                                v[0] = null;
                            }
                        }
                    } else {
                        observers[i][1].disconnect();
                        observers[i][1] = null;
                    }
                }
            } else {
                // 不处于功能对应页面
                if (!observers[i][3]()) {
                    if (observers[i][1] !== null) {
                        if (observers[i][1] instanceof Array) {
                            const _len = observers[i][1];
                            for (let j = 0; j < _len; j++) {
                                const v = observers[i][1][j];
                                v[0].disconnect();
                                v[0] = null;
                            }
                        } else {
                            observers[i][1].disconnect();
                            observers[i][1] = null;
                        }
                    }
                } else {
                    // 如果没有直接重新创建
                    if (observers[i][1] instanceof Array) {
                        // ob组特殊处理
                        const _len = observers[i][1];
                        for (let j = 0; j < _len; j++) {
                            const v = observers[i][1][j];
                            if (!v[2]()) {
                                if (v[0] !== null) {
                                    v[0].disconnect();
                                    v[0] = null;
                                }
                            } else if (v[0] === null) {
                                v[0] = v[1]();
                            }
                        }
                    } else if (observers[i][1] === null) {
                        observers[i][1] = observers[i][2]();
                    }
                }
            }
        }
    };

    // 10. 兼容模式检测是否PJAX并刷新页面, https://stackoverflow.com/a/4585031/6335926
    ((history) => {
        const pushState = history.pushState;
        history.pushState = function (state) {
            if (typeof history.onpushstate == "function") {
                history.onpushstate({ state });
            }
            GM.getValue(GMkeys.MO, true).then((enableMO) => {
                if (enableMO) {
                    return;
                }
                location.reload();
            });
            return pushState.apply(history, arguments);
        };
    })(window.history);
});
