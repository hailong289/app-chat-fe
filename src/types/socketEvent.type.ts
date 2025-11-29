export enum socketEvent {
  MSGSEND = "message:send",
  JOINROOM = "join",
  ROOMUPSERT = "room:upsert",
  MSGUPSERT = "message:upsert",
  MSGREACT = "message:emoji",
  MSGPINNED = "message:pinned",
  MSGDELETE = "message:delete",
  MSGRECALL = "message:recall",
  USERSATUS = "check:status_online",
  USERTYPING = "user:typing",
  STATUSTYPING = "on:typing",
  ERRORMSG = "error:message",
  USERJOIN = "user:join",
  VERYFIỄPTION = "exception",
  STATUS = "status:online",
  ROOMDELETE = "room:delete",
  MSGMARKREAD = "mark:read",
}

export enum notifyType {
  noify_new_message = "notify:new:message",
}
