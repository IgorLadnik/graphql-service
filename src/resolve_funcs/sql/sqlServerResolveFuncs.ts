import { ILogger } from '../../logger';
import { SqlServerProvider } from './sqlServerProvider';
import { TypesCommon } from '../../gql_infra/typesCommon';
import { logger } from "../../app";
import _ from 'lodash';

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
        let retVal: any;
        const cxtKey = '_level0_user';
        if (_.isNil(contextVar[cxtKey])) {
            logger.log('fetchData_user() - sql - actual access to database');

            TypesCommon.updateFieldTypeFilter(field, contextVar);
            const queryArgs = TypesCommon.getQueryArgs(field);
            const query = `SELECT ${queryArgs} FROM Users WHERE id = ${args.id}`;
            contextVar[cxtKey] = await sqlResolveFns.fetchFromDb(query, contextConst);
        }
        else {
            logger.log('fetchData_user() - sql');

            if (!_.isNil(parent))
                retVal = contextVar[cxtKey];
        }

        return retVal;
    },

    fetchData_personChats: async (field: any, args: any, contextConst: any, contextVar: any,
                                  parent: any): Promise<Array<any>> => {
        let retVal: any;
        const cxtKey = '_level0_chats';
        if (_.isNil(contextVar[cxtKey])) {
            logger.log('fetchData_personChats() - sql - actual access to database');

            TypesCommon.updateFieldTypeFilter(field, contextVar);
            const query = `SELECT * FROM Chats WHERE id in
                                     (SELECT chatId FROM Participants WHERE userId in
                                        (SELECT id FROM Users WHERE name = '${args.personName}'))`;
            contextVar[cxtKey] = await sqlResolveFns.fetchFromDb(query, contextConst);
        }
        else {
            logger.log('fetchData_personChats() - sql');

            if (!_.isNil(parent))
              retVal = contextVar[cxtKey];
        }

        return retVal;
    },

    fetchData_personChats_participants: async (field: any, args: any, contextConst: any, contextVar: any,
                                               parent: any): Promise<Array<any>> => {
        let retVal: any;
        const cxtKey = '_level1_participants';
        if (_.isNil(contextVar[cxtKey])) {
            // Fetching data from database on the 1st call only
            logger.log('fetchData_personChats_participants() - sql - actual access to database');

            TypesCommon.updateFieldTypeFilter(field, contextVar);
            const queryArgs = TypesCommon.getQueryArgs(field);

            const strChatIds = contextVar['_level0_chats']?.map((c: any) => c.id)?.toString();
            const query = `
                SELECT ${queryArgs}, Participants.chatId AS chatId FROM Users
                INNER JOIN Participants
                ON Users.id = Participants.userId
                WHERE Participants.chatId in (${strChatIds})
            `;
            contextVar[cxtKey] = await sqlResolveFns.fetchFromDb(query, contextConst);
        }
        else {
            logger.log('fetchData_personChats_participants() - sql');

            if (!_.isNil(parent)) {
                const items = contextVar[cxtKey];
                retVal = _.filter(items, (item: any) => item.chatId === parent.id)
            }
        }

        return retVal;
    },

    fetchData_personChats_messages: async (field: any, args: any, contextConst: any, contextVar: any,
                                           parent: any): Promise<Array<any>> => {
        let retVal: any;
        const cxtKey = '_level1_messages';
        if (_.isNil(contextVar[cxtKey])) {
            // Fetching data from database on the 1st call only
            logger.log('fetchData_personChats_messages() - sql - actual access to database');

            TypesCommon.updateFieldTypeFilter(field, contextVar);
            const queryArgs = TypesCommon.getQueryArgs(field);

            const strChatIds = contextVar['_level0_chats']?.map((c: any) => c.id)?.toString();
            const query = `SELECT * FROM ChatMessages WHERE chatId in (${strChatIds})`;
            contextVar[cxtKey] = await sqlResolveFns.fetchFromDb(query, contextConst);
        }
        else {
            logger.log('fetchData_personChats_messages() - sql');

            if (!_.isNil(parent)) {
                TypesCommon.setFilter('ChatMessage', ['id', 'text', 'time', 'authorId', 'chatId'], contextVar);

                const items = contextVar[cxtKey];
                retVal = _.filter(items, (item: any) => item.chatId === parent.id);
            }
        }

        return retVal;
    },

    fetchData_personChats_messages_author: async (field: any, args: any, contextConst: any, contextVar: any,
                                                  parent: any): Promise<Array<any>> => {
        let retVal: any;
        const cxtKey = '_level2_messages_author';
        if (_.isNil(contextVar[cxtKey])) {
            // Fetching data from database on the 1st call only
            logger.log('fetchData_personChats_messages_author() - sql - actual access to database');

            TypesCommon.updateFieldTypeFilter(field, contextVar);
            const queryArgs = TypesCommon.getQueryArgs(field);

            const strAuthorIds = contextVar['_level1_messages'].map((m: any) => m.authorId).toString();
            const query = `SELECT id, ${queryArgs} FROM Users WHERE id in (${strAuthorIds})`;
            contextVar[cxtKey] = await sqlResolveFns.fetchFromDb(query, contextConst);
        }
        else {
            logger.log('fetchData_personChats_messages_author() - sql');

            if (!_.isNil(parent)) {
                const items = contextVar[cxtKey];
                retVal = _.filter(items, (item: any) => item.id === parent.authorId);
            }
        }

        return retVal;
    },

    fetchFromDb: async (query: string, contextConst: any): Promise<Array<any>> =>
        await contextConst['sql'].query(query)
}