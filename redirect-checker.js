#!/usr/bin/env node

const generator = require('./index');
const { program } = require('commander');

program.requiredOption(
  '--url <url>',
  'Base URL entries will be tested against. ',
);
program.option(
  '--source <source>',
  'Relative path to csv or xlsx file',
  './input/redirects.xlsx',
);
program.option(
  '--sheets <sheets>',
  'Exclude only certain sheets by name, comma separated. e.g: jahresreport,halb jahres report',
);
program.option(
  '--googleSheetsId <sheetId>',
  'Google Sheet Id - eg. https://docs.google.com/spreadsheets/d/<google-sheets-id>',
);
program.option('--debug', 'debug');
program.option('--to-nginx', 'toNginx');

program.parse(process.argv);

async function main() {
  try {
    const options = program.opts();
    const sheets = options.sheets ? options.sheets.split(',') : null;
    generator({
      baseUrl: options.url,
      sheetId: options.googleSheetsId,
      source: options.source,
      sheets,
      debug: options.debug,
      toNginx: options.toNginx,
    });
  } catch (error) {
    if (error.signal !== 'SIGINT') {
      console.error(error); // eslint-disable-line no-console
    }
  }
}

main();
