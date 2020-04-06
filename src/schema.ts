export type Maybe<T> = T | null;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  Date: any;
};

export type Chat = Node & {
   __typename?: 'Chat';
  id: Scalars['ID'];
  common: Scalars['String'];
  users: Array<User>;
  messages: Array<ChatMessage>;
};

export type ChatMessage = Node & {
   __typename?: 'ChatMessage';
  id: Scalars['ID'];
  common: Scalars['String'];
  content: Scalars['String'];
  time: Scalars['Date'];
  user: User;
};


export type Node = {
  id: Scalars['ID'];
  common: Scalars['String'];
};

export type Query = {
   __typename?: 'Query';
  me: User;
  user?: Maybe<User>;
  allUsers?: Maybe<Array<Maybe<User>>>;
  search: Array<SearchResult>;
  myChats: Array<Chat>;
};


export type QueryUserArgs = {
  id: Scalars['ID'];
};


export type QuerySearchArgs = {
  term: Scalars['String'];
};

export enum Role {
  User = 'USER',
  Admin = 'ADMIN'
}

export type SearchResult = User | Chat | ChatMessage;

export type User = Node & {
   __typename?: 'User';
  //id: Scalars['ID'];
  //common: Scalars['String'];
  username: Scalars['String'];
  email: Scalars['String'];
  role: Role;
};
