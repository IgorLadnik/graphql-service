import { ILogger } from './logger';
import { SqlServerProvider } from './sqlServerProvider';
import { TypesCommon } from './typesCommon';

export async function connectToSql (logger: ILogger): Promise<any> {
    const server = 'IGORMAIN\\MSSQLSERVER01';
    const database = 'ChatsDb';
    let sql = new SqlServerProvider({server, database}, logger);
    try {
        await sql.connect();
    }
    catch (err) {
        logger.log(`*** Error in connection to database {server: \"${server}\", database: ${database}. ${err}`);
        return false;
    }

    return sql;
}

export async function fetchData_user(field: any, args: any, contextConst: any, contextVar: any,
                                     parent: any): Promise<Array<any>> {
    console.log('fetchData_user()');
    TypesCommon.updateFieldTypeFilter(field, contextVar);
    const queryArgs = TypesCommon.getQueryArgs(field);
    const query = `SELECT ${queryArgs} FROM Users WHERE id = ${args.id}`;
    return fetchFromDb(query, contextConst, parent);
}

export async function fetchData_myChats(field: any, args: any, contextConst: any, contextVar: any,
                                        parent: any): Promise<Array<any>> {
    console.log('fetchData_myChats()');
    TypesCommon.updateFieldTypeFilter(field, contextVar); //?
    const query = `SELECT * FROM Chats WHERE id in
                                     (SELECT chatId FROM Participants WHERE userId in
                                        (SELECT id FROM Users WHERE name = 'Rachel'))`;
    return fetchFromDb(TypesCommon.tuneQueryString(query, parent), contextConst, parent);
}

export async function fetchData_myChats_participants(field: any, args: any, contextConst: any, contextVar: any,
                                                     parent: any): Promise<Array<any>> {
    console.log('fetchData_myChats_participants()');
    TypesCommon.updateFieldTypeFilter(field, contextVar);
    const queryArgs = TypesCommon.getQueryArgs(field);
    const query =
        `SELECT ${queryArgs} FROM Users WHERE id in` +
        '(SELECT userId FROM Participants WHERE chatId = ${parent.id})';
    return fetchFromDb(TypesCommon.tuneQueryString(query, parent), contextConst, parent);
}

export async function fetchData_myChats_messages(field: any, args: any, contextConst: any, contextVar: any,
                                                 parent: any): Promise<Array<any>> {
    console.log('fetchData_myChats_messages()');
    const query = 'SELECT id, text, authorId FROM ChatMessages WHERE chatId = ${parent.id}';
    contextVar['ChatMessage_properties'] = ['text', 'authorId'];
    return fetchFromDb(TypesCommon.tuneQueryString(query, parent), contextConst, parent);
}

export async function fetchData_myChats_messages_author(field: any, args: any, contextConst: any, contextVar: any,
                                                        parent: any): Promise<Array<any>> {
    console.log('fetchData_myChats_messages_author()');
    TypesCommon.updateFieldTypeFilter(field, contextVar);
    const queryArgs = TypesCommon.getQueryArgs(field);
    const query = `SELECT ${queryArgs} FROM ` + 'Users WHERE id = ${parent.authorId}';
    return fetchFromDb(TypesCommon.tuneQueryString(query, parent), contextConst, parent);
}

export async function fetchFromDb(query: string, contextConst: any, parent: any): Promise<Array<any>> {
    return await contextConst['sql'].query(TypesCommon.tuneQueryString(query, parent));
}
