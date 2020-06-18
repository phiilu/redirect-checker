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
  --url <url>        Base URL entries will be tested against.
  --source <source>  Relative path to csv or xlsx file (default:
                     "./input/redirects.xlsx")
  --sheets <sheets>  Exclude only certain sheets by name, comma separated.
                     e.g: jahresreport,halb jahres report
  --debug            debug
  --to-nginx         toNginx
  -h, --help         display help for command
```

Run basic check 
```bash
./redirect-checker --url "https://wienenergie.at"
```
