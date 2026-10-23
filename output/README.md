# 週報JSONの出力先

ChatGPTの定期タスクが生成したセキュリティ週報を、このフォルダに保存します。

- ブランチ: main
- ファイル名: YYYYMMDD_security-weekly.json
- 文字コード: UTF-8
- YYYYMMDDは対象期間の初日をAsia/Tokyoの年月日で表します（ハイフンなし）。
- 例: 2026年10月19日〜25日の週報は20261019_security-weekly.jsonです。
- 同じ週を再作成した場合は同じファイルを更新し、過去の内容はGitの履歴に残します。
- 保存したJSONはGitHubからダウンロードし、閲覧画面へ手動インポートします。

このフォルダには実際に調査・作成した週報だけを格納します。架空の完成例はspec/sample-report.jsonを参照してください。
