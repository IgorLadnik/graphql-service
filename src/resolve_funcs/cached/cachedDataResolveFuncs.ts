import { Role } from "../../types/types";
import { GqlTypesCommon } from '../../gql_infra/gqlTypesCommon';
import { logger } from "../../app";
import _ from "lodash";
import { Utils } from '../../gql_infra/utils';

export const users = [
    { type: 'User', id: 1, name: 'Moshe',    email: 'moshe@a.com',    role: Role.Admin },
    { type: 'User', id: 2, name: 'Avi',      email: 'avi@a.com',      role: Role.User  },
    { type: 'User', id: 3, name: 'Zeev',     email: 'zeev@a.com',     role: Role.User  },
    { type: 'User', id: 4, name: 'Anat',     email: 'anat@a.com',     role: Role.Admin },
    { type: 'User', id: 5, name: 'Menachem', email: 'menachem@a.com', role: Role.User  },
    { type: 'User', id: 6, name: 'Yossi',    email: 'yossi@a.com',    role: Role.User  },
    { type: 'User', id: 7, name: 'Rachel',   email: 'rachel@a.com',   role: Role.User  },
];

export const chatMessages = [
    { type: 'ChatMessage', id: 1, text: 'text1', time: '2020-04-07', authorId: 3, chatId: 2 },
    { type: 'ChatMessage', id: 2, text: 'text2', time: '2020-04-07', authorId: 2, chatId: 1 },
    { type: 'ChatMessage', id: 3, text: 'text3', time: '2020-04-07', authorId: 1, chatId: 3 },
    { type: 'ChatMessage', id: 4, text: 'text4', time: '2020-04-07', authorId: 7, chatId: 1 },
    { type: 'ChatMessage', id: 5, text: 'text5', time: '2020-04-07', authorId: 5, chatId: 3 },
    { type: 'ChatMessage', id: 6, text: 'text6', time: '2020-04-07', authorId: 4, chatId: 4 },
    { type: 'ChatMessage', id: 7, text: 'text7', time: '2020-04-07', authorId: 1, chatId: 1 },
    { type: 'ChatMessage', id: 8, text: 'text8', time: '2020-04-07', authorId: 4, chatId: 5 },
];

export const chats = [
    { type: 'Chat', id: 1, topic: 'topic1' },
    { type: 'Chat', id: 2, topic: 'topic2' },
    { type: 'Chat', id: 3, topic: 'topic3' },
    { type: 'Chat', id: 4, topic: 'topic4' },
    { type: 'Chat', id: 5, topic: 'topic5' }
];

export const participants = [
    { id: 1, chatId: 1, userId: 7 },
    { id: 2, chatId: 2, userId: 4 },
    { id: 3, chatId: 3, userId: 6 },
    { id: 4, chatId: 5, userId: 2 },
    { id: 5, chatId: 5, userId: 5 },
    { id: 6, chatId: 4, userId: 1 },
    { id: 7, chatId: 4, userId: 2 },
    { id: 8, chatId: 1, userId: 1 },
    { id: 9, chatId: 5, userId: 7 },
]

export const cachedResolveFns = {
    getObjects: async (arr: Array<any>, propertyName: string, arrId: Array<any>): Promise<Array<any>> => {
        const results = new Array<any>();
        arr.forEach((p: any) => {
            if (arrId.includes(p[propertyName]))
                results.push(p);
        });

        return results;
    },

    //-- Queries ----------------------------------------------------------------------------

    query_dummy: async (field: any, args: any, contextConst: any, contextVar: any,
                           parent: any): Promise<Array<any>> => {
        let retVal: any;
        if (!_.isNil(parent)) {
            logger.log(`${contextVar[Utils.handlerIdPrefix]}query_dummy() - cached`);

        }

        return retVal;
    },

    query_user: async (field: any, args: any, contextConst: any, contextVar: any,
                           parent: any): Promise<Array<any>> => {
        let retVal: any;
        if (!_.isNil(parent)) {
            logger.log(`${contextVar[Utils.handlerIdPrefix]}query_user() - cached`);
            GqlTypesCommon.updateFieldTypeFilter(field, contextVar);
            retVal = await cachedResolveFns.getObjects(users, 'id', [args.id]);
        }

        return retVal;
    },

    query_personChats: async (field: any, args: any, contextConst: any, contextVar: any,
                                  parent: any): Promise<Array<any>> => {
        let retVal: any;
        if (!_.isNil(parent)) {
            logger.log(`${contextVar[Utils.handlerIdPrefix]}query_personChats() - cached`);
            GqlTypesCommon.updateFieldTypeFilter(field, contextVar); //?
            const u = (await cachedResolveFns.getObjects(users, 'name', [args.personName]))[0];
            const ps = await cachedResolveFns.getObjects(participants, 'userId', [u.id]);
            retVal = await cachedResolveFns.getObjects(chats, 'id', ps.map((p: any) => p.chatId));
        }

        return retVal;
    },

    query_personChats_participants: async (field: any, args: any, contextConst: any, contextVar: any,
                                               parent: any): Promise<Array<any>> => {
        let retVal: any;
        if (!_.isNil(parent)) {
            logger.log(`${contextVar[Utils.handlerIdPrefix]}query_personChats_participants() - cached`);
            GqlTypesCommon.updateFieldTypeFilter(field, contextVar);
            const ps = await cachedResolveFns.getObjects(participants, 'chatId', [parent.id]);
            retVal = await cachedResolveFns.getObjects(users, 'id', ps.map((p: any) => p.userId));
        }

        return retVal;
    },

    query_personChats_messages: async (field: any, args: any, contextConst: any, contextVar: any,
                                           parent: any): Promise<Array<any>> => {
        let retVal: any;
        if (!_.isNil(parent)) {
            logger.log(`${contextVar[Utils.handlerIdPrefix]}query_personChats_messages() - cached`);
            contextVar[`ChatMessage${GqlTypesCommon.suffixPropsFilter}`] = ['text', 'time', 'authorId'];
            const ret = await cachedResolveFns.getObjects(chatMessages, 'chatId', [parent.id]);
            retVal = await cachedResolveFns.getObjects(chatMessages, 'chatId', [parent.id]);
        }

        return retVal;
    },

    query_personChats_messages_author: async (field: any, args: any, contextConst: any, contextVar: any,
                                                  parent: any): Promise<Array<any>> => {
        let retVal: any;
        if (!_.isNil(parent)) {
            logger.log(`${contextVar[Utils.handlerIdPrefix]}query_personChats_messages_author() - cached`);
            GqlTypesCommon.updateFieldTypeFilter(field, contextVar);
            retVal = await cachedResolveFns.getObjects(users, 'id', [parent.authorId]);
        }

        return retVal;
    },

    //-- Mutations ----------------------------------------------------------------------------

    mutation_dummy: async (field: any, args: any, contextConst: any, contextVar: any,
                           parent: any): Promise<Array<any>> => {
        let retVal: any;
        const callerId = `${contextVar[Utils.handlerIdPrefix]}`;
        logger.log(`${callerId}mutation_dummy() - cached`);

        if (!_.isNil(args)) {
            logger.log(`${callerId}args = ${JSON.stringify(args)}`);
        }

        return args;
    },
}
