import { GqlSchemaParser } from "./gqlSchemaParser";
const graphql = require('graphql');
import _ from 'lodash';
import { GraphQLResolveInfo } from "graphql";

const {
    GraphQLObjectType,
    GraphQLString,
    GraphQLSchema,
    GraphQLID,
    GraphQLInt,
    GraphQLList,
} = graphql;

const Role = {
    User: 'USER',
    Admin: 'ADMIN'
};

// Data ------------------------------------------------------------------------------------
const users = [
    { name: 'User', id: '0', username: 'Julius Verne', email: 'jv@MysteriousIsland.com', role: Role.Admin },
    { name: 'User', id: '1', username: 'Cyrus Smith', email: 'cs@MysteriousIsland.com', role: Role.User },
    { name: 'User', id: '2', username: 'Gedeon Spilett', email: 'gs@MysteriousIsland.com', role: Role.User },
];

const chatMessages = [
    { name: 'ChatMessage', id: '0', content: 'aaaaaaa', time: Date.parse('2020-04-05'), author: users[1] },
    { name: 'ChatMessage', id: '1', content: 'bbbbbbb', time: Date.parse('2020-04-05'), author: users[2] },
];

const chats = [
    { name: 'Chat', id: '0', participants: [users[0], users[2]], messages: [chatMessages[0], chatMessages[1]] },
    { name: 'Chat', id: '1', participants: [users[1], users[0]], messages: [chatMessages[0], chatMessages[1]] },
];
// -----------------------------------------------------------------------------------------

const User = new GraphQLObjectType({
    name: 'User',
    fields: () => ({
        id: { type: GraphQLID },
        username: { type: GraphQLString },
        email: { type: GraphQLString },
        role: { type: GraphQLString }
    })
});

const ChatMessage = new GraphQLObjectType({
    name: 'ChatMessage',
    fields: () => ({
        id: { type: GraphQLID },
        content: { type: GraphQLString },
        time: { type: GraphQLString },
        author: { type: User },
    })
});

const Chat = new GraphQLObjectType({
    name: 'Chat',
    fields: () => ({
        id: { type: GraphQLID },
        participants: {
            type: new GraphQLList(User),
            resolve: (parent: any, args: any) => parent.participants
        },
        messages: {
            type: new GraphQLList(ChatMessage),
            resolve: (parent: any, args: any) => parent.messages
        }
    })
});

export function setResolversAfterStartListening(gqlSchemaParser: GqlSchemaParser,
                                         users: Array<any>, chats: Array<any>, chatMessages: Array<any>) {
    gqlSchemaParser.setResolvers(
        //-------------------------------------------------------------------------------------------
        {
            resolverName: 'me',
            fn: (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
                console.log('resolver: me');
                return users[0];
            }
        },
        //-------------------------------------------------------------------------------------------
        {
            resolverName: 'user',
            fn: (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
                //_.filter(pms, pm => pm.id === parent.id)[0]?.name
                console.log(`resolver: user(${parent.id})`);
                return users[parent.id];
            }
        },
        //-------------------------------------------------------------------------------------------
        {
            resolverName: 'allUsers',
            fn: (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
                console.log('resolver: allUsers');
                return users;
            }
        },
        //-------------------------------------------------------------------------------------------
        {
            resolverName: 'search',
            fn: (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
                console.log(`resolver: parent.id = ${parent.term}`);
                let collection;
                switch (parent.term.toLowerCase()) {
                    case 'users': collection = users; break;
                    case 'chats': collection = chats; break;
                    case 'chatmessages': collection = chatMessages; break;
                    default: collection = _.flatten(_.concat(users, chats, chatMessages)); break;
                }
                return collection;
            }
        },
        //-------------------------------------------------------------------------------------------
        {
            resolverName: 'myChats',
            fn: (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
                console.log('resolver: myChats');
                return chats; //TEMP
            }
        },
        //-------------------------------------------------------------------------------------------
    );
}


// const Query = new GraphQLObjectType({
//     name: 'Query',
//     fields: {
//
//         me: {
//             type: User,
//             resolve: (parent: any, args: any) => users[0]
//         },
//
//         user: {
//             type: User,
//             args: { id: { type: GraphQLID } },
//             resolve: (parent: any, args: any) => _.find(users, { id: args.id })
//         },
//
//         allUsers: {
//             type: GraphQLList(User),
//             resolve: (parent: any, args: any) => users
//         },
//
//         search: {
//             type: GraphQLList(User), //TEMP
//             args: { term: { type: GraphQLString } },
//             resolve: (parent: any, args: any) => {
//                 let collection;
//                 switch (args.term.toLowerCase()) {
//                     case 'users': collection = users; break;
//                     case 'chats': collection = chats; break;
//                     case 'chatmessages': collection = chatMessages;  break;
//                     //default: collection = _.flatten(_.concat(users, chats, chatMessages)); break;
//                 }
//                 return collection;
//             }
//         },
//
//         myChats: {
//             type: GraphQLList(Chat),
//             resolve: (parent: any, args: any) => chats //TEMP
//         },
//     }
// });
//
// module.exports = new GraphQLSchema({
//     query: Query
// });

/*
query {
  me {
	id
    email
  }
}
query {
  user(id: 1) {
	username
    id
  }
}
query {
  allUsers {
	role
    username
    id
  }
}
query {
  search(term: "Users") {
	id
    email
  }
}
query {
  myChats {
		id
    participants {
      username
    }
    messages {
      author {
      	username
    	}
      content
    }
  }
}
*/
