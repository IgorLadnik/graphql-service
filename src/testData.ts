import { Role } from "./types";
import { GqlProvider, IGqlProvider } from "./gqlProvider";
import _ from "lodash";

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

export const getUserIdByChatId = (arrChatId: Array<number>): any => {
    participants.forEach((p: any) => {
        if (arrChatId.includes(p.chatId))
            return p.userId;

        return -1;
    });
}

export const getById = (collecionName: string, arrId: Array<number>): any => {
    [collecionName].forEach((p: any) => {
        if (arrId.includes(p.id))
            return p;

        return null;
    });
}
