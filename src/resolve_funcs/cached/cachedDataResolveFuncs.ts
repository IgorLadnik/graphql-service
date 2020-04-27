import { Role } from "../../types/types";
import { TypesCommon } from '../../gql_infra/typesCommon';
import { logger } from "../../app";

export const users = [
    { type: 'User', id: 1, name: 'Moshe',   email: 'moshe@a.com',    role: Role.Admin },
    { type: 'User', id: 2, name: 'Avi',     email: 'avi@a.com',      role: Role.User  },
    { type: 'User', id: 3, name: 'Zeev',    email: 'zeev@a.com',     role: Role.User  },
    { type: 'User', id: 4, name: 'Anat',    email: 'anat@a.com',     role: Role.Admin },
    { type: 'User', id: 5, name: 'Menachem', email: 'menachem@a.com', role: Role.User  },
    { type: 'User', id: 6, name: 'Yossi',   email: 'yossi@a.com',    role: Role.User  },
    { type: 'User', id: 7, name: 'Rachel',  email: 'rachel@a.com',   role: Role.User  },
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

export const testResolveFns = {
    getObjects: async (arr: Array<any>, propertyName: string, arrId: Array<any>): Promise<Array<any>> => {
        const results = new Array<any>();
        arr.forEach((p: any) => {
            if (arrId.includes(p[propertyName]))
                results.push(p);
        });

        return results;
    },

    fetchData_user: async (field: any, args: any, contextConst: any, contextVar: any,
                                              parent: any): Promise<Array<any>> => {
        logger.log('fetchData_user() - cached');
        TypesCommon.updateFieldTypeFilter(field, contextVar);
        return await testResolveFns.getObjects(users, 'id', [args.id]);
    },

    fetchData_personChats: async (field: any, args: any, contextConst: any, contextVar: any,
                                                 parent: any): Promise<Array<any>> => {
        logger.log('fetchData_personChats() - cached');
        TypesCommon.updateFieldTypeFilter(field, contextVar); //?
        const u = (await testResolveFns.getObjects(users, 'name', [args.personName]))[0];
        const ps = await testResolveFns.getObjects(participants, 'userId', [u.id]);
        return await testResolveFns.getObjects(chats, 'id', ps.map((p: any) => p.chatId));
    },

    fetchData_personChats_participants: async (field: any, args: any, contextConst: any, contextVar: any,
                                                              parent: any): Promise<Array<any>> => {
        logger.log('fetchData_personChats_participants() - cached');
        TypesCommon.updateFieldTypeFilter(field, contextVar);
        const ps = await testResolveFns.getObjects(participants, 'chatId', [parent.id]);
        return await testResolveFns.getObjects(users, 'id', ps.map((p: any) => p.userId));
    },

    fetchData_personChats_messages: async (field: any, args: any, contextConst: any, contextVar: any,
                                       parent: any): Promise<Array<any>> => {
        logger.log('fetchData_personChats_messages() - cached');
        contextVar[`ChatMessage${TypesCommon.suffixPropsFilter}`] = ['text', 'authorId'];
        const ret = await testResolveFns.getObjects(chatMessages, 'chatId', [parent.id]);
        return await testResolveFns.getObjects(chatMessages, 'chatId', [parent.id]);
    },

    fetchData_personChats_messages_author: async (field: any, args: any, contextConst: any, contextVar: any,
                                              parent: any): Promise<Array<any>> => {
        logger.log('fetchData_personChats_messages_author() - cached');
        TypesCommon.updateFieldTypeFilter(field, contextVar);
        return await testResolveFns.getObjects(users, 'id', [parent.authorId]);
    }
}
