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

export const Role = {
    User: 'USER',
    Admin: 'ADMIN'
};

export const User = new GraphQLObjectType({
    name: 'User',
    fields: () => ({
        id: { type: GraphQLID },
        username: { type: GraphQLString },
        email: { type: GraphQLString },
        role: { type: GraphQLString }
    })
});

export const ChatMessage = new GraphQLObjectType({
    name: 'ChatMessage',
    fields: () => ({
        id: { type: GraphQLID },
        content: { type: GraphQLString },
        time: { type: GraphQLString },
        author: { type: User },
    })
});

export const Chat = new GraphQLObjectType({
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

/*
export const Query = new GraphQLObjectType({
    name: 'Query',
    fields: {

        dummy: {
            // type: undefined,
            // args: undefined,
            // resolve: (parent, args) => undefined
        },

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
*/

/* Queries

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