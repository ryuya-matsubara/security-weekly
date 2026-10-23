# security-weekly

ChatGPTが作成したセキュリティ週報を、iPhoneやPCで読める静的Webアプリです。

## 閲覧
公開先: ht…2078 tokens truncated…定期実行でも同じ機能が利用できると判断しない。

## 3. スケジュールの登録
初期提案は毎週月曜07:00、Asia/Tokyo。曜日・時刻は変更可。
1. ChatGPTのスケジュール画面で独立した定期タスクを作る。
2. 実行プロンプトはChatGPT側の指示欄で管理する。
3. 指示にリポジトリ名、mainの同じコミットから取得する必須4仕様ファイル、調査・JSON作成・outputへの保存を指定する。
4. ファイル名・文字コード・対象期間を現在の調査方針と合わせる。
5. 繰り返し・時刻・タイムゾーン・次回実行日時を確認して保存する。
6. 接続・再接続・権限の問題が表示されたら解決する。

必須4ファイル:
- spec/research-policy.md
- spec/sources.json
- spec/report.schema.json
- spec/sample-report.json

調査方針は毎回読み直す。ChatGPTの指示本文はリポジトリの変更だけでは更新されない。
過去の指示に「Web公開しない」「手動インポート」などが残っている場合は、公開済みoutputへ保存し閲覧画面で自動取得する現在の構成に合わせて変更する。
定期タスクがリポジトリの公開範囲やPages設定を操作する必要はない。

## 4. 通知と閲覧
1. ChatGPTとiPhoneの設定でタスクの完了通知を有効にする。
2. 完了後に閲覧画面を開くと最新号が表示される。
3. 開いたままの場合は「更新」で最新のファイル一覧を取得する。
4. 「週報を選ぶ」で過去号に切り替えられる。
5. 必要な場合は「週報JSONをダウンロード」で表示中のJSONを保存する。

自動ポーリングは行わない。閲覧画面への手動インポートは不要。

## 5. 更新・保守
- spec/research-policy.md: 調査・保存ルールを変更したらpolicy_versionを上げ、完成例にも反映する。
- spec/report.schema.json: JSON形式を変更したらschema_version・完成例・閲覧画面の対応版を合わせる。
- spec/sources.json: 情報源を変更したらsources_versionを上げる。
- spec/sample-report.json: is_example=trueを維持し、output/には保存しない。
- output/: 同じ週は同じファイルを更新する。過去の内容はGitの履歴に残る。
- 実行プロンプト: ChatGPT側で管理する。
- 閲覧画面: mainへの変更をGitHub Pagesが公開する。

## 6. 読み込み・保存に失敗した場合
- 閲覧画面が404: Pagesの公開元と公開処理の状態を確認する。
- データが取得できない: リポジトリがPublicか、main/outputが存在するか確認する。
- 週報がない: ファイル名がYYYYMMDD_security-weekly.jsonか確認する。READMEや他形式の名前は一覧に含めない。
- APIの利用制限: 画面に表示された時刻を目安に待ってから再試行する。匿名APIの上限はIP単位で毎時60回。
- JSONの読み込みエラー: UTF-8、schema_version、対象期間とファイル名、必要項目を確認する。最新号の失敗を古い週報で自動的に置き換えることはない。
- 一部調査が未完了: partialの週報を表示し、調査範囲・未確認事項も確認できる。
- ChatGPTからの保存失敗: 書き込み権限・mainへのコミット可否を確認する。保存成功と報告しない。
- 保存競合: 最新mainを取得し直して対象JSONだけを適用する。force pushは行わない。

## 公式情報
- [GitHub Pagesの公開元設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHubのファイル取得API](https://docs.github.com/en/rest/repos/contents)
- [GitHub APIの利用制限](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [ChatGPT Scheduled tasks](https://learn.chatgpt.com/docs/automations)

