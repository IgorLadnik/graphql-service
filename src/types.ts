
function resolve(contextVar: any, typeName: string) {
    const strData = `${typeName}_data`;
    const strProperties = `${typeName}_properties`;
    let inItem = contextVar[strData];
    const outItem: any = { };
    contextVar[strProperties].forEach((p: string) => outItem[p] = inItem[p]);
    contextVar[strData] = outItem;
    console.log('resolve() for type ${typeName}');
}

export const User = {
    type: 'User',
    id: 0,
    name: '',
    email: '',
    role: '',
    resolveFunc: (actionTree: any, args: any, contextConst: any, contextVar: any) =>
        resolve(contextVar, 'User')
};

export const ChatMessage = {
    type: 'ChatMessage',
    id: 0,
    text: '',
    time: '',
    author: User,
    resolveFunc: (actionTree: any, args: any, contextConst: any, contextVar: any) =>
        resolve(contextVar, 'ChatMessage')
};

export const Chat = {
    type: 'Chat',
    id: 0,
    topic: '',
    participants: [User],
    messages: [ChatMessage],
    resolveFunc: (actionTree: any, args: any, contextConst: any, contextVar: any) =>
        resolve(contextVar, 'Chat')
};

export const Role = {
    User: 'USER',
    Admin: 'ADMIN'
};
