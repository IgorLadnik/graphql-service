import { union } from "lodash";
const graphql = require('graphql');
const _ = require('lodash');

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
    { name: 'ChatMessage', id: '0', content: 'aaaaaaa', time: Date.parse('2020-04-05'), user: users[1] },
    { name: 'ChatMessage', id: '1', content: 'bbbbbbb', time: Date.parse('2020-04-05'), user: users[2] },
];

const chats = [
    { name: 'Chat', id: '0', users: [users[0], users[2]], messages: [chatMessages[0], chatMessages[1]] },
    { name: 'Chat', id: '1', users: [users[1], users[0]], messages: [chatMessages[0], chatMessages[1]] },
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
        users: {
            type: new GraphQLList(User),
            args: {
                id: { type: GraphQLID },
            },
            resolve(parent, args) {
                return _.filter(users, {authorId: parent.id});
            }
        }
    })
});

const Chat = new GraphQLObjectType({
    name: 'Chat',
    fields: () => ({
        id: { type: GraphQLID },
        users: {
            type: new GraphQLList(User),
            args: {
                id: { type: GraphQLID },
            },
            resolve(parent, args) {
                return _.filter(users, {authorId: parent.id});
            }
        },
        messages: {
            type: new GraphQLList(ChatMessage),
            args: {
                id: { type: GraphQLID },
            },
            resolve(parent, args) {
                return _.filter(users, {authorId: parent.id});
            }
        }
    })
});

const Query = new GraphQLObjectType({
    name: 'Query',
    fields: {

        me: {
            type: User,
            resolve(parent, args) { return users[0]; }
        },

        user: {
            type: User,
            args: { id: { type: GraphQLID } },
            resolve(parent, args) {
                return _.find(users, { id: args.id });
            }
        },

        allUsers: {
            type: GraphQLList(User),
            resolve(parent, args) { return users; }
        },

        search: {
            type: GraphQLList(User), //TEMP
            args: { term: { type: GraphQLString } },
            resolve(parent, args) {
                let collection;
                switch (args.term.toLowerCase()) {
                    case 'users': collection = users; break;
                    case 'chats': collection = chats; break;
                    case 'chatmessages': collection = chatMessages;  break;
                    default: collection = _.flatten(_.concat(users, chats, chatMessages)); break;
                }
                return collection;
            }
        },

        myChats: {
            type: GraphQLList(Chat),
            resolve(parent, args) {
                return chats; //TEMP
            }
        },
    }
});

module.exports = new GraphQLSchema({
    query: Query
});

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
    users {
      id
      username
    }
  }
}

*/