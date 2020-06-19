const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { google } = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(credentials) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0],
  );

  // Check if we have previously stored a token.
  try {
    const token = await fs.promises.readFile(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
  } catch (e) {
    return getNewToken(oAuth2Client);
  }
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Get Sheet Data
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth 2.0 client.
 */
const getSheetData = async ({ auth, sheetId, exclusiveSheets }) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      includeGridData: true,
      ranges: [],
    });

    let rawSheets = [...response.data.sheets];
    if (exclusiveSheets) {
      rawSheets = rawSheets.filter(({ properties: { title } }) =>
        exclusiveSheets.includes(title),
      );
    }
    return rawSheets.map(({ properties: { title: name }, data }) => {
      const [, ...rows] = data[0].rowData;
      return {
        name,
        items: rows.map((row) => {
          if (!row.values) {
            return null;
          }
          return row.values.map(({ formattedValue }) => formattedValue);
        }),
      };
    });
  } catch (e) {
    console.error(e);
  }
};

async function main({ sheetId, exclusiveSheets }) {
  try {
    // Load client secrets from a local file.
    const content = await fs.promises.readFile(
      path.resolve(__dirname, './credentials.json'),
    );
    const auth = await authorize(JSON.parse(content));
    const sheetData = await getSheetData({ sheetId, auth, exclusiveSheets });
    return sheetData;
  } catch (error) {
    if (error) return console.log('Error loading client secret file:', error);
    // Authorize a client with credentials, then call the Google Docs API.

    if (error.signal !== 'SIGINT') {
      console.error(error); // eslint-disable-line no-console
    }
  }
}
module.exports = main;
