import { Role } from "../../types/types";
import { TypesCommon } from '../../gql_infra/typesCommon';

export const users = [
    { type: 'User', id: 1, name: 'Moshe',   email: 'moshe@a.com',    role: Role.Admin },
    { type: 'User', id: 2, name: 'Avi',     email: 'avi@a.com',      role: Role.User  },
    { type: 'User', id: 3, name: 'Zeev',    email: 'zeev@a.com',     role: Role.User  },
    { type: 'User', id: 4, name: 'Anat',    email: 'anat@a.com',     role: Role.Admin },
    { type: 'User', id: 5, name: 'Menchem', email: 'menachem@a.com', role: Role.User  },
    { type: 'User', id: 6, name: 'Yossi',   email: 'yossi@a.com',    role: Role.User  },
    { type: 'User', id: 7, name: 'Rachel',  email: 'rachel@a.com',   role: Role.User  },
];

export const chatMessages = [
    { type: 'ChatMessage', id: 1, content: 'text1', time: Date.parse('2020-04-07'), authorId: 3, chatId: 2 },
    { type: 'ChatMessage', id: 2, content: 'text2', time: Date.parse('2020-04-07'), authorId: 2, chatId: 1 },
    { type: 'ChatMessage', id: 3, content: 'text3', time: Date.parse('2020-04-07'), authorId: 1, chatId: 3 },
    { type: 'ChatMessage', id: 4, content: 'text4', time: Date.parse('2020-04-07'), authorId: 7, chatId: 1 },
    { type: 'ChatMessage', id: 5, content: 'text5', time: Date.parse('2020-04-07'), authorId: 5, chatId: 3 },
    { type: 'ChatMessage', id: 6, content: 'text6', time: Date.parse('2020-04-07'), authorId: 4, chatId: 4 },
    { type: 'ChatMessage', id: 7, content: 'text7', time: Date.parse('2020-04-07'), authorId: 1, chatId: 1 },
    { type: 'ChatMessage', id: 8, content: 'text8', time: Date.parse('2020-04-07'), authorId: 4, chatId: 5 },
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
        console.log('fetchData_user_test()');
        TypesCommon.updateFieldTypeFilter(field, contextVar);
        return await testResolveFns.getObjects(users, 'id', [args.id]);
    },

    fetchData_myChats: async (field: any, args: any, contextConst: any, contextVar: any,
                                                 parent: any): Promise<Array<any>> => {
        console.log('fetchData_myChats_test()');
        TypesCommon.updateFieldTypeFilter(field, contextVar); //?
        const u = (await testResolveFns.getObjects(users, 'name', ['Rachel']))[0];
        const ps = await testResolveFns.getObjects(participants, 'userId', [u.id]);
        return await testResolveFns.getObjects(chats, 'id', ps.map((p: any) => p.chatId));
    },

    fetchData_myChats_participants: async (field: any, args: any, contextConst: any, contextVar: any,
                                                              parent: any): Promise<Array<any>> => {
        console.log('fetchData_myChats_participants_test()');
        TypesCommon.updateFieldTypeFilter(field, contextVar);
        const ps = await testResolveFns.getObjects(participants, 'chatId', [parent.id]);
        return await testResolveFns.getObjects(users, 'id', ps.map((p: any) => p.userId));
    },

    fetchData_myChats_messages: async (field: any, args: any, contextConst: any, contextVar: any,
                                                          parent: any): Promise<Array<any>> => {
        console.log('fetchData_myChats_messages_test()');
        contextVar['ChatMessage_properties'] = ['text', 'authorId'];
        return await testResolveFns.getObjects(chatMessages, 'chatId', [parent.id]);
    },

    fetchData_myChats_messages_author: async (field: any, args: any, contextConst: any, contextVar: any,
                                                                 parent: any): Promise<Array<any>> => {
        console.log('fetchData_myChats_messages_author_test()');
        TypesCommon.updateFieldTypeFilter(field, contextVar);
        return await testResolveFns.getObjects(users, 'id', [parent.authorId]);
    }
}
