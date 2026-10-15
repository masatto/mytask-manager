package com.masatto.mytask.common;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * 組み込んだ画面（React）のページ URL（/today、/rules?rule=1 など）を index.html に転送する。
 * 画面の切り替えはブラウザ側（React Router）で行うので、サーバーには index.html を返すだけでよい。
 *
 * 対象は「1階層で、拡張子（.）を含まないパス」。/api/... やファイル（/assets/xxx.js、/favicon.svg）は対象外。
 * 画面を組み込んでいない開発時・テスト時は、転送先の index.html がないので 404 になる。
 */
@Controller
public class SpaController {

    @GetMapping({ "/", "/{path:[^\\.]*}" })
    public String forward() {
        return "forward:/index.html";
    }
}
