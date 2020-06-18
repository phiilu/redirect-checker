const csv = require('csv-parser');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const XLSX = require('xlsx');
const PromisePool = require('es6-promise-pool');
const Dnscache = require('dnscache');
const Agent = require('agentkeepalive');
const fs = require('fs');
const path = require('path');



const createDNSCache = () =>
  new Dnscache({ enable: true, ttl: 300, cachesize: 1000 });

createDNSCache();
const exportToNginx = async groups => {
  const structure = groups
    .map(group => {
      const groupStructure = group.items
        .map(
          ([oldUrl, newUrl, comment, exclude, testonly, regexEnabled]) =>
            `${oldUrl} ${newUrl};`,
        )
        .join('\n');
      return `#
# ${group.name}
#
${groupStructure}`;
    })
    .join('\n');

  // useful for kinsta
  await fs.promises.writeFile(
    path.resolve(__dirname, './output/redirects.txt'),
    `map $request_uri $redirect{
  ${structure}
}`,
    'utf8',
  );

  await fs.promises.writeFile(
    path.resolve(__dirname, './output/redirects.map'),
    structure,
    'utf8',
  );
};

const writeErrors = async outputErrors => {
  await fs.promises.writeFile(
    path.resolve(__dirname, './output/errors.json'),
    JSON.stringify(outputErrors),
    'utf8',
  );
  await fs.promises.writeFile(
    path.resolve(__dirname, './output/errors.csv'),
    outputErrors
      .map(line => [line.original.oldUrl, line.original.newUrl, line.error])
      .join('\n'),
    'utf8',
  );
};

const csvParser = ({ source }) => {
  const parseResult = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(source)
      .pipe(
        csv({
          mapHeaders: ({ index }) => index,
        }),
      )
      .on('data', data => parseResult.push(Object.values(data)))
      .on('end', async () => {
        resolve([{ name: 'general', items: parseResult }]);
      });
  });
};
const xlsxParser = ({ source, exclusiveSheets }) => {
  return new Promise((resolve, reject) => {
    const { Sheets } = XLSX.readFile(source);
    // eslint-disable-next-line compat/compat
    const sheets = Object.entries(Sheets);
    let parsed = [];
    sheets.forEach(([sheetName, sheet]) => {
      if (exclusiveSheets && !exclusiveSheets.includes(sheetName)) {
        return;
      }
      const sheetData = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        blankrows: true,
      });
      const sheetParsed = [];
      sheetData.forEach((row, index) => {
        if (index === 0) {
          return;
        }
        sheetParsed.push(row);
      });
      parsed = [
        ...parsed,
        {
          name: sheetName,
          items: sheetParsed,
        },
      ];
    });
    resolve(parsed);
  });
};
const parsers = {
  '.csv': csvParser,
  '.xlsx': xlsxParser,
};

const cleanResults = res => {
  // 0 = oldUrl
  // 1 - newUrl
  // 2 - comment
  // 3 - exclude
  // 4 - testonly (also excluded)
  // 4 - regexEnabled (also excluded)

  return res.map(group => ({
    ...group,

    items: group.items.filter(
      ([oldUrl, newUrl, comment, exclude, testonly, regexEnabled]) => {
        if (!newUrl) {
          return false;
        }

        if (exclude) {
          return false;
        }
        return true;
      },
    ),
  }));
};

const checker = async ({
  baseUrl,
  source = './input/redirects.csv',
  toNginx,
  debug = false,
  sheets: exclusiveSheets,
}) => {
  const errors = [];
  const connectionPoolOptions = {
    maxSockets: 5,
    timeout: 25000,
    maxFreeSockets: 256,
    freeSocketTimeout: 15000,
  };
  const httpsAgent = new Agent.HttpsAgent(connectionPoolOptions);
  const api = axios.create({
    httpsAgent,
  });
  axiosRetry(api, {
    retries: 3,
    retryDelay: retryCount => retryCount * 1000,
    retryCondition: error => {
      const retrieablErrors = ['ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH'];
      if (error.code && retrieablErrors.includes(error.code)) {
        return true;
      }
      return false;
    },
  });
  if(debug){
    setInterval(() => {
      if (httpsAgent.statusChanged) {
        console.log(
          '[%s] agent status changed: %j',
          Date(),
          httpsAgent.getCurrentStatus(),
          );
        }
      }, 2000);
  }

  

  const checkUrl = async ({ oldUrl, newUrl, comment, testonly, regexEnabled }) => {
    if(regexEnabled){
      return; 
    }
    try {
      const response = await api.get(`${baseUrl}${oldUrl}`);
      const fetchedUrl = response.request.res.responseUrl;
      const expectedUrl = newUrl;
      if (debug) {
        console.log('expected');
        console.log(expectedUrl);
        console.log('fetched');
      }
      let clean = expectedUrl.startsWith('http')
        ? fetchedUrl
        : fetchedUrl.split(baseUrl)[1];
      if(testonly && debug){
        console.log('test-only')
      }
      if (clean !== expectedUrl) {
        if (clean === undefined) {
          debugger;
        }
        errors.push({
          original: {
            oldUrl,
            newUrl,
          },
          error: `mismatch - ${fetchedUrl}`,
        });
        console.error(`MISMATCH - expected: ${newUrl} - got: ${clean}`);
      }
      if (debug) {
        console.log(clean);
        console.log('');
      }
    } catch (e) {
      if (e.code === 'ETIMEDOUT') {
        console.log('timeout');
        return;
      }
      if (!e.response) {
        if (e.code === 'EHOSTUNREACH') {
          console.error('HOST UNREACHABLE - ');
          return;
        }
        errors.push({
          original: {
            oldUrl,
            newUrl,
          },
          error: 'max_redirects_exceeded',
        });
        console.log('');
        return;
      }
      errors.push({
        original: {
          oldUrl,
          newUrl,
        },
        error: e.response.status,
      });
      console.error(`404 - expected: ${newUrl}`);
      console.log('');
    }
  };
  // eslint-disable-next-line func-names
  const checkUrls = function*(groups) {
    const rows = [];
    groups.forEach(group => group.items.forEach(item => rows.push(item)));
    console.log(
      `start test of ${groups.length} groups - ${rows.length} redirects`,
    );
    console.log(`start test of ${rows.length} redirects`);
    // eslint-disable-next-line no-restricted-syntax
    for (const index of rows.keys()) {
      if (debug) {
        console.log(`current: ${index}`);
      }
      const [oldUrl, newUrl, comment, exclude, testonly, regexEnabled] = rows[index];
      // eslint-disable-next-line no-await-in-loop
      yield checkUrl({ oldUrl, newUrl, comment, exclude, testonly, regexEnabled });
    }
  };
  const fileEnding = path.extname(source);
  // determine source - start parsers
  let results = await parsers[fileEnding]({
    source: path.resolve(__dirname, source),
    exclusiveSheets,
  });
  try {
    results = cleanResults(results);
    if (toNginx) {
      await exportToNginx(results);
    }
    const promiseIterator = checkUrls(results);
    const pool = new PromisePool(promiseIterator, 3);

    await pool.start();

    console.log('done');

    await writeErrors(errors);
  } catch (e) {
    debugger;
    console.error(e);
  }
};

module.exports = checker;
