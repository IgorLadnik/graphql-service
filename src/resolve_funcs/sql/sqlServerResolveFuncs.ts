import { ILogger } from '../../logger';
import { SqlServerProvider } from './sqlServerProvider';
import { TypesCommon } from '../../gql_infra/typesCommon';

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

export const sqlResolveFns = {
    fetchData_user: async (field: any, args: any, contextConst: any, contextVar: any,
                                         parent: any): Promise<Array<any>> => {
        console.log('fetchData_user() - sql');
        TypesCommon.updateFieldTypeFilter(field, contextVar);
        const queryArgs = TypesCommon.getQueryArgs(field);
        const query = `SELECT ${queryArgs} FROM Users WHERE id = ${args.id}`;
        return sqlResolveFns.fetchFromDb(query, contextConst, parent);
    },

    fetchData_myChats: async (field: any, args: any, contextConst: any, contextVar: any,
                                            parent: any): Promise<Array<any>> => {
        console.log('fetchData_myChats() - sql');
        TypesCommon.updateFieldTypeFilter(field, contextVar); //?
        const query = `SELECT * FROM Chats WHERE id in
                                     (SELECT chatId FROM Participants WHERE userId in
                                        (SELECT id FROM Users WHERE name = 'Rachel'))`;
        return sqlResolveFns.fetchFromDb(TypesCommon.tuneQueryString(query, parent), contextConst, parent);
    },

    fetchData_myChats_participants: async (field: any, args: any, contextConst: any, contextVar: any,
                                                         parent: any): Promise<Array<any>> => {
        console.log('fetchData_myChats_participants() - sql');
        TypesCommon.updateFieldTypeFilter(field, contextVar);
        const queryArgs = TypesCommon.getQueryArgs(field);
        const query =
            `SELECT ${queryArgs} FROM Users WHERE id in` +
            '(SELECT userId FROM Participants WHERE chatId = ${parent.id})';
        return sqlResolveFns.fetchFromDb(TypesCommon.tuneQueryString(query, parent), contextConst, parent);
    },

    fetchData_myChats_messages: async (field: any, args: any, contextConst: any, contextVar: any,
                                                     parent: any): Promise<Array<any>> => {
        console.log('fetchData_myChats_messages() - sql');
        const query = 'SELECT id, text, authorId FROM ChatMessages WHERE chatId = ${parent.id}';
        contextVar['ChatMessage_properties'] = ['text', 'authorId'];
        return sqlResolveFns.fetchFromDb(TypesCommon.tuneQueryString(query, parent), contextConst, parent);
    },

    fetchData_myChats_messages_author: async (field: any, args: any, contextConst: any, contextVar: any,
                                                            parent: any): Promise<Array<any>> => {
        console.log('fetchData_myChats_messages_author() - sql');
        TypesCommon.updateFieldTypeFilter(field, contextVar);
        const queryArgs = TypesCommon.getQueryArgs(field);
        const query = `SELECT ${queryArgs} FROM ` + 'Users WHERE id = ${parent.authorId}';
        return sqlResolveFns.fetchFromDb(TypesCommon.tuneQueryString(query, parent), contextConst, parent);
    },

    fetchFromDb: async (query: string, contextConst: any, parent: any): Promise<Array<any>> =>
        await contextConst['sql'].query(TypesCommon.tuneQueryString(query, parent))
}