import { Tooltip } from "@heroui/react";
import { useTranslation } from "react-i18next";

interface Reaction {
  emoji: string;
  count: number;
  hasReacted?: boolean;
  users: Array<{
    _id: string;
    usr_id: string;
    usr_fullname: string;
    usr_avatar: string;
  }>;
}

interface MessageReactionsProps {
  reactions: Reaction[];
}

export function MessageReactions({
  reactions,
}: Readonly<MessageReactionsProps>) {
  const { t } = useTranslation();
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {reactions.map((reaction, idx) => (
        <Tooltip
          key={`${reaction.emoji}-${idx}`}
          content={
            <div className="text-xs dark:text-gray-200">
              {reaction.users
                ?.map((u) => u.usr_fullname || t("chat.user"))
                .join(", ")}
            </div>
          }
          size="sm"
        >
          <button
            className={`
              flex items-center gap-1 px-2 py-1 rounded-full
              text-xs font-medium transition-all duration-200

              ${
                reaction.hasReacted
                  ? `
                      bg-blue-100 border-2 border-blue-400 
                      dark:bg-blue-500/20 dark:border-blue-400
                    `
                  : `
                      bg-gray-100 border border-gray-300 hover:bg-gray-200
                      dark:bg-gray-800 dark:border-gray-700 
                      dark:hover:bg-gray-700
                    `
              }
            `}
          >
            <span className="text-sm">{reaction.emoji}</span>
            <span className="text-gray-600 dark:text-gray-300">
              {reaction.count}
            </span>
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
