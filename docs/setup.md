# ChatGPTでのスケジュール登録手順

更新日: 2026-10-23

## このリポジトリの範囲
調査仕様とJSON交換形式を管理し、毎週生成した実ニュースの週報JSONをoutput/に保存する。閲覧画面、自動配信プログラム、GitHub Actionsは今回含めない。
リポジトリは非公開のままでよい。生成した週報はmainブランチのoutput/からダウンロードし、将来の閲覧画面へ手動インポートする。

## 1. GitHub接続と環境
1. ChatGPTの設定でGitHubのプラグイン/アプリを接続する。表示名は環境によって異なる。
2. GitHub側の連携アプリのリポジトリアクセスにryuya-matsubara/security-weeklyを追加し、ファイルの読み取りと書き込みが利用できることを確認する。
3. ChatGPT WebのWorkで新しいチャットを開き、GitHub連携での読み取り・書き込みとWeb検索が利用できる構成を選ぶ。
4. 「Scheduled / スケジュール済み」が利用できることを確認する。なければアカウント・ワークスペースの提供状況を確認する。CLI/IDEのみでは登録画面を使えない。

ローカルプロジェクトを使うデスクトップ側の自動化とは区別する。自宅PC常時起動を前提にしないWeb側のタスクを選ぶ。
この会話でGitHubリポジトリの読み書きが成功しても、将来の定期実行でGitHubでの読み取り・書き込みとWeb検索が利用できることまで確認済みとはならない。

## 2. タスクの登録
初期提案: 毎週月曜07:00、Asia/Tokyo。曜日・時刻は変更可。
1. ChatGPTのスケジュール画面で、独立した定期タスクとして登録する。各回の必須仕様はGitHubから読み直す。
2. 実行指示はChatGPT側の指示欄で管理する。このリポジトリにプロンプトファイルは保存しない。
3. 指示欄には、対象リポジトリ、mainの同一コミットから取得する必須4仕様ファイル、調査・JSON作成・GitHub保存の実行指示を指定する。
4. 保存先はmainのoutput/YYYYMMDD_security-weekly.jsonとし、UTF-8で保存する。YYYYMMDDは対象期間の初日をAsia/Tokyoの年月日で表す。例: 2026年10月19日〜25日が対象ならoutput/20261019_security-weekly.json。
5. スケジュール欄を毎週月曜07:00、日本時間にする。
6. 作成結果を開き、繰り返し・タイムゾーン・次回実行・指示全文を確認する。作成完了が表示されなければ登録済みと扱わない。
7. タスクで外部アプリの接続・再接続・承認が必要と表示されたら、先に解決する。定期実行で解決できると仮定して先へ進めない。

参照する仕様は毎回mainから読むため、4仕様ファイルの内容変更は次回に反映される。ファイルパスやタスクの実行方法を変えた場合、ChatGPT側に保存した指示も更新する。
リポジトリの変更でChatGPT側の指示本文が自動更新されるわけではない。

## 3. 通知とiPhoneでの取得
1. ChatGPTの設定→通知で、タスクに利用できるプッシュ通知を有効にする。メール通知が利用できる場合は選択可。
2. iPhoneの設定でもChatGPTの通知を許可する。
3. 完了通知から結果を開き、保存先のGitHubファイルリンクをタップする。非公開リポジトリにアクセスできるGitHubアカウントでログインする。
4. GitHubのファイル画面からRaw表示またはダウンロードでJSONを取得し、共有メニュー等から「ファイルに保存」する。将来の閲覧画面でそのJSONを選択する。
標準の通知メールはGmail連携から本人名義でメールを送る処理とは別。添付メールやLINE連携は初期運用に含めない。

## 4. 更新・保守
- spec/research-policy.md: 編集ルールを更新しpolicy_versionを上げる。
- spec/sources.json: 情報源・人物を更新しsources_versionを上げる。
- spec/report.schema.json: JSON形式の変更時にschema_versionと完成例を合わせる。
- spec/sample-report.json: is_example=trueを維持する。実ニュースを偽装しない。
- 実行プロンプト: ChatGPT側で管理する。起動時の指示を変更する場合は、スケジュールの指示欄を編集する。
- 各週報のspec.commit_shaで、実際に使用した仕様の版を追跡できる。出力を保存したコミットSHAはタスク結果に示す。
- 保存先はmainのoutput/YYYYMMDD_security-weekly.json。日付は対象期間の初日（Asia/Tokyo）。同じ週を再作成した場合は同じファイルを更新する。過去の内容はGitの履歴から参照できる。
- 閲覧画面は将来schema_versionを確認し、未対応の形式やis_example=trueを適切に扱う。

## 5. 失敗時
- GitHub取得失敗: リポジトリアクセスとパスを確認。公開Web検索で非公開本文を代用しない。
- 仕様取得途中の失敗: 成功したファイルだけで調査を続行しない。
- 情報源の一部取得失敗: coverageに記録しpartialとして出力。
- GitHub保存不可: 書き込み権限やmainへのコミット可否を確認し、失敗を結果に明示する。保存済みと称したりリンクを捏造したりしない。
- 保存時の競合: 最新のmainを取得し直し、対象JSONだけを適用する。force pushは行わない。
- 通知なし: Scheduledで実行状態と結果を確認。通知設定と実行失敗を区別する。

## 公式情報
以下は作成時に参照した公式ドキュメント。UI・提供範囲は変更される場合がある。
- [Scheduled tasks](https://learn.chatgpt.com/docs/automations)
- [Notifications](https://learn.chatgpt.com/docs/notifications)
- [Connecting GitHub to ChatGPT](https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt)
