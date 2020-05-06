import _ from 'lodash';
import { ILogger } from '../../logger';
import { logger } from "../../app";
import { SqlServerProvider } from './sqlServerProvider';
import { GqlTypesCommon } from '../../gql_infra/gqlTypesCommon';
import { Utils } from '../../gql_infra/utils';

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
    //-- Common for queries -----------------------------------------------------------

    fetchFromDb: async (query: string, contextConst: any): Promise<Array<any>> =>
        await contextConst['sql'].query(query),

    sqlQuery: async (fnName: string, cxtKey: string,
                     field: any, args: any, contextConst: any, contextVar: any, parent: any,
                     getQueryFn: Function, filterFn: Function): Promise<Array<any>> => {
        let retVal: any;
        const callerId = `${contextVar[Utils.handlerIdPrefix]}`;
        if (_.isNil(contextVar[cxtKey])) {
            // Fetching data from database on the 1st call only
            logger.log(`${callerId}${fnName}() - sql - actual access to database`);
            try {
                contextVar[cxtKey] = await sqlResolveFns.fetchFromDb(getQueryFn(), contextConst);
            }
            catch (err) {
                logger.log(`${callerId}*** Error in fetching part of resolve function \"${fnName}()\". ${err}`);
            }
        }
        else {
            logger.log(`${callerId}${fnName}() - sql`);

            if (!_.isNil(parent)) {
                try {
                    retVal = filterFn(contextVar[cxtKey]);
                }
                catch (err) {
                    logger.log(`${callerId}*** Error in filter part of resolve function \"${fnName}()\". ${err}`);
                }
            }
        }

        return retVal;
    },

    // query_dummy: async (field: any, args: any, contextConst: any, contextVar: any,
    //                     parent: any): Promise<Array<any>> => {
    //     let retVal: any;
    //     if (!_.isNil(parent)) {
    //         logger.log(`${contextVar[Utils.handlerIdPrefix]}query_dummy() - sql`);
    //
    //     }
    //
    //     return retVal;
    // },

    //-- Queries ----------------------------------------------------------------------------

    query_user: async (field: any, args: any, contextConst: any, contextVar: any,
                                parent: any): Promise<Array<any>> => {
        const cxtKey = '_level0_user';
        return await sqlResolveFns.sqlQuery('query_user',
                cxtKey, field, args, contextConst, contextVar, parent,
            () => {
                GqlTypesCommon.updateFieldTypeFilter(field, contextVar);
                const queryArgs = GqlTypesCommon.getQueryArgs(field);
                return `SELECT ${queryArgs} FROM Users WHERE id = ${args.id}`;
            },
            () => contextVar[cxtKey]
        );
    },

    query_personChats: async (field: any, args: any, contextConst: any, contextVar: any,
                                  parent: any): Promise<Array<any>> => {
        const cxtKey = '_level0_chats';
        return await sqlResolveFns.sqlQuery('query_personChats',
                cxtKey, field, args, contextConst, contextVar, parent,
            () => {
                GqlTypesCommon.updateFieldTypeFilter(field, contextVar);
                return `SELECT * FROM Chats WHERE id in
                          (SELECT chatId FROM Participants WHERE userId in
                              (SELECT id FROM Users WHERE name = '${args.personName}'))`;
            },
            () => contextVar[cxtKey]
        );
    },

    query_personChats_participants: async (field: any, args: any, contextConst: any, contextVar: any,
                                               parent: any): Promise<Array<any>> => {
        const cxtKey = '_level1_participants';
        return await sqlResolveFns.sqlQuery('query_personChats_participants',
                cxtKey, field, args, contextConst, contextVar, parent,
            () => {
                GqlTypesCommon.updateFieldTypeFilter(field, contextVar);
                const queryArgs = GqlTypesCommon.getQueryArgs(field);
                const strChatIds = contextVar['_level0_chats']?.map((c: any) => c.id)?.toString();
                return `
                        SELECT ${queryArgs}, Participants.chatId AS chatId FROM Users
                        INNER JOIN Participants
                        ON Users.id = Participants.userId
                        WHERE Participants.chatId in (${strChatIds})
                    `;
            },
            () => _.filter(contextVar[cxtKey], (item: any) => item.chatId === parent.id)
        );
    },

    query_personChats_messages: async (field: any, args: any, contextConst: any, contextVar: any,
                                           parent: any): Promise<Array<any>> => {
        const cxtKey = '_level1_messages';
        return await sqlResolveFns.sqlQuery('query_personChats_messages',
                cxtKey, field, args, contextConst, contextVar, parent,
            () => {
                GqlTypesCommon.updateFieldTypeFilter(field, contextVar);
                const queryArgs = GqlTypesCommon.getQueryArgs(field);
                const strChatIds = contextVar['_level0_chats']?.map((c: any) => c.id)?.toString();
                return `SELECT * FROM ChatMessages WHERE chatId in (${strChatIds})`;
            },
            () => {
                GqlTypesCommon.setFilter(
                    'ChatMessage', ['id', 'text', 'time', 'authorId', 'chatId'], contextVar);
                return _.filter(contextVar[cxtKey], (item: any) => item.chatId === parent.id);
            }
        );
    },

    query_personChats_messages_author: async (field: any, args: any, contextConst: any, contextVar: any,
                                                  parent: any): Promise<Array<any>> => {
        const cxtKey = '_level2_messages_author';
        return await sqlResolveFns.sqlQuery('query_personChats_messages_author',
                cxtKey, field, args, contextConst, contextVar, parent,
            () => {
                GqlTypesCommon.updateFieldTypeFilter(field, contextVar);
                const queryArgs = GqlTypesCommon.getQueryArgs(field);
                const strAuthorIds = contextVar['_level1_messages'].map((m: any) => m.authorId).toString();
                return `SELECT id, ${queryArgs} FROM Users WHERE id in (${strAuthorIds})`;
             },
            () => _.filter(contextVar[cxtKey], (item: any) => item.id === parent.authorId)
        );
    },

    //-- Mutations ----------------------------------------------------------------------------

    mutation_addMessage: async (field: any, args: any, contextConst: any, contextVar: any,
                           parent: any): Promise<Array<any>> => {
        let retVal: any;
        const callerId = `${contextVar[Utils.handlerIdPrefix]}`;
        logger.log(`${callerId}mutation_dummy() - sql`);

        if (!_.isNil(args)) {
            logger.log(`${callerId}args = ${JSON.stringify(args)}`);
        }

        return args;
    },
}