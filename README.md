# Redirect Checker

The Redirect Checker is a cli that allows to generate an nginx map from csvs/xlsx & checks the validity of the redirect - according to the input. 

## Installation 

`yarn`

## Usage

To get an overview of all available options run 

```bash
./redirect-checker --help
```

**Output:** 
```
Usage: redirect-checker [options]

Options:
  --url <url>                 Base URL entries will be tested against.
  --source <source>           Relative path to csv or xlsx file (default: "./input/redirects.xlsx")
  --sheets <sheets>           Exclude only certain sheets by name, comma separated. e.g: jahresreport,halb jahres report
  --googleSheetsId <sheetId>  Google Sheet Id - eg. https://docs.google.com/spreadsheets/d/<google-sheets-id>
  --debug                     enables additional output
  --to-nginx                  creates an an redirects.map & redirects.txt nginx file
  -h, --help                  display help for command
```

Run basic check 
```bash
./redirect-checker --url "https://wienenergie.at"
```


## Available Sources

### File Based
* csv
* xlsx

### Cloud Based

**Google Sheets**

Usage: 
1. Add your credentials.json to /drivers/credentials.json
   (https://developers.google.com/sheets/api/quickstart/nodejs)
2. run the `redirect-checker` with the `--googleSheetsId "ID-HERE"` option
3. You're all set. The script now uses the google sheet as the source

> Please be aware the the file has to be a "real" google sheet (you can spot an invalid "xlsx" sheet by the green "xlsx" next to the sheet title)

