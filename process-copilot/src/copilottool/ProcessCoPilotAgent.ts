import * as vscode from 'vscode';

import Logger from '../utilities/logUtils';
import { getDatabaseContext, getDatabasePool, runQuery } from '../utilities/databaseUtils';
import { IRecordSet, IResult } from 'mssql';

async function activateProcessCopilotAgent(context: vscode.ExtensionContext) {
    Logger.log('Activating Process Copilot Agent...');

    vscode.chat.createChatParticipant("process-copilot", async (
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        response: vscode.ChatResponseStream,
        token: vscode.CancellationToken
        ) => {

            const userQuery = request.prompt;            

            const chatModels =  await vscode.lm.selectChatModels({family: 'gpt-4'});

            response.progress("Reading database context...");
            let pool = await getDatabasePool();
            try{
                const dbContext = await getDatabaseContext(pool);

                const dbContextString = dbContext.recordset.map(row => JSON.stringify(row)).join('\n');
                response.progress("Database context read successfully.");

                const messages = [
                    vscode.LanguageModelChatMessage.Assistant("You are a process mining expert with significant experience with SQL databases."+
                        "You are provided with the Database Context as follows: \n Database Context: "+ dbContextString + 
                        "\n\n You need to follow the user ask and provide the needed SQL query using the provided database context."+
                        "Understand the database context and provide a SQL query that can be run against the database."+
                        "Always make sure the joins are correct and the query is valid."+
                        "Finally, Make sure you provide a valid SQL query that begins with ````sql and ends with ```."),
                    vscode.LanguageModelChatMessage.User(userQuery)
                ];

                const chatRequest = await chatModels[0].sendRequest(messages, undefined, token);
                let data  = "";

                for await (const chunks of chatRequest.text){
                    response.markdown(chunks);
                    data += chunks;
                }

                const sqlRegex = /```[^\n]*\n([\s\S]*)\n```/g;
                const match = sqlRegex.exec(data);
                console.log("match: "+ match);

                if (match && match[1]) {
                    response.progress("Query received let me work on data.");
                    if(pool === undefined || pool === null || pool.connected === false){
                        pool = await getDatabasePool();
                    }

                    const sqlResults = await runQuery(pool, match[1]);
                    console.log("rowsAffected: ", sqlResults.rowsAffected);

                    response.progress("Take a look at data.");
                    const formattedData = formatIResultAsHtmlTable(sqlResults);
                    // Create a webview panel to display the results
                    const datapanel = vscode.window.createWebviewPanel(
                        'resultsWebview',
                        'SQL Query Results',
                        vscode.ViewColumn.One,
                        {
                            enableScripts: true,
                        });
                    
                    datapanel.webview.html = getSQLWebviewContent(formattedData);
                    
                    response.progress("Working on the view.");
                    const new_messages = [
                        vscode.LanguageModelChatMessage.Assistant("You are D3.js expert with significant experience with SQL databases and JSON formats."+
                            "You will be provided with the JSON Response and you will need to do as follows:"+
                            "1. First you will convert the JSON Response to a D3.js compatible data format."+
                            "2. You will then used the converted D3.js compatible data and create an html page and create d3js charts"+
                            "\n\n JSON Response : "+ JSON.stringify(sqlResults.recordset) +"\n\n"+
                            "You will only generate D3.js compatible html page with the charts and nothing else."+
                            "Do not provide any other text or explanation or any markdown format"),
                    ];

                    const botResponseStream = await chatModels[0].sendRequest(new_messages, undefined, token);
                    let fullResponse = '';
                    for await (const chunk of botResponseStream.text) {
                        fullResponse += chunk;
                    }
                    
                    const panel = vscode.window.createWebviewPanel(
                        'chartsWebview',
                        'SQL Query Results',
                        vscode.ViewColumn.One,
                        {
                            enableScripts: true,
                        });
                    
                    panel.webview.html = getSQLWebviewContent(fullResponse);
                } 
            }catch (error) {
                Logger.error('Error: ', error);
            }
            finally{
                pool.close();
            }

            
    });

    
    Logger.log('Process Copilot Agent activated successfully.');
}

export {activateProcessCopilotAgent};

/**
 * Converts a SQL IResult<any> object to an HTML table string.
 * @param result The result object returned by mssql query.
 * @returns A string containing the HTML table.
 */
export function formatIResultAsHtmlTable(result: IResult<any>): string {
  const rows = result.recordset;

  if (!rows || rows.length === 0) {
    return '<table border="1"><tr><td>No data</td></tr></table>';
  }

  const columns = Object.keys(rows[0]);
  let html = '<table border="1"><thead><tr>';

  // Header
  html += columns.map(col => `<th>${escapeHtml(col)}</th>`).join('');
  html += '</tr></thead><tbody>';

  // Rows
  rows.forEach(row => {
    html += '<tr>';
    html += columns.map(col => `<td>${escapeHtml(String(row[col]))}</td>`).join('');
    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

// Optional: Escape HTML entities to prevent XSS or broken layout
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, match => {
    const escapeMap: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return escapeMap[match];
  });
}

function getSQLWebviewContent(sqlResultsHTML: string): string {
  return `<!DOCTYPE html>
<html>
  <body>
    ${sqlResultsHTML}
  </body>
</html>`;
}

function getD3WebviewContent(results: string): string {
  return `<!DOCTYPE html>
<html>
    <head>
        <script src="https://d3js.org/d3.v7.min.js"></script>
    </head>
    <body>
        ${results}
    </body>
</html>`;
}