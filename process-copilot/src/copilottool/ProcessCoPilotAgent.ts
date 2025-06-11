import * as vscode from 'vscode';

import Logger from '../utilities/logUtils';
import { getDatabaseContext, getDatabasePool, runQuery } from '../utilities/databaseUtils';

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
            const pool = await getDatabasePool();
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
                    response.button({ 
                        title: 'Run Query', 
                        command: 'process-copilot.runQuery', 
                        arguments: [match[1]] 
                    });
                }
            }catch (error) {
                Logger.error('Error getting database pool: ', error);
            }
            finally{
                pool.close();
            }

            //Register the command to run the SQL query
            vscode.commands.registerCommand('process-copilot.runQuery', async (sqlQuery: string) => {
                const pool = await getDatabasePool();
                try{
                    const sqlResults = (await runQuery(pool, sqlQuery));
                    console.log("output: "+ sqlResults.output);
                    console.log("rowsAffected: ", sqlResults.rowsAffected);

                }catch (error) {
                    Logger.error('Error running query: ', error);
                    vscode.window.showErrorMessage('Failed to run the SQL query. Please check the console for details.');
                    return;
                }finally{
                    pool.close();
                }
                
            });
            
    });
    Logger.log('Process Copilot Agent activated successfully.');
}

export {activateProcessCopilotAgent};