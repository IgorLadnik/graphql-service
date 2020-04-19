import { typesCommon } from './app';

export const User = {
    type: 'User',
    id: 0,
    name: '',
    email: '',
    role: '',
    resolveFunc: (field: any, args: any, contextConst: any, contextVar: any) =>
        typesCommon.filter('User', contextVar)
};

export const ChatMessage = {
    type: 'ChatMessage',
    id: 0,
    text: '',
    time: '',
    author: User,
    resolveFunc: (field: any, args: any, contextConst: any, contextVar: any) =>
        typesCommon.filter('ChatMessage', contextVar)
};

export const Chat = {
    type: 'Chat',
    id: 0,
    topic: '',
    participants: [User],
    messages: [ChatMessage],
    resolveFunc: (field: any, args: any, contextConst: any, contextVar: any) =>
        typesCommon.filter('Chat', contextVar)
};

export const Role = {
    User: 'USER',
    Admin: 'ADMIN'
};
