import formatTimeAgo from "@/libs/forrmattime";
import { ContactType } from "@/store/types/contact.type";
import useContactStore from "@/store/useContactStore";
import { Avatar, Badge, Button, Card, CardBody } from "@heroui/react";

interface InvaitationSentModalProps {
  readonly item: ContactType;
  readonly onPress?: () => void;
  readonly type: "sent" | "received" | "all";
}
export default function ItemContact({
  item,
  onPress,
  type = "all",
}: InvaitationSentModalProps) {
  const contactState = useContactStore((state) => state);
  return (
    <Card
      key={item.id}
      className="mb-2 shadow-none border border-teal-100 cursor-pointer"
      onPress={onPress}
    >
      <CardBody className="flex items-center py-3 flex-row" onClick={onPress}>
        <Badge
          content=" "
          color={item.isOnline ? "success" : "default"}
          placement="bottom-right"
        >
          <Avatar
            src={item.avatar || undefined}
            name={item.fullname}
            size="md"
            isBordered
          />
        </Badge>
        {type === "all" && (
          <div className="ml-3">
            <h4 className="font-medium">{item.fullname}</h4>
            <p className="text-sm text-gray-500">
              {formatTimeAgo(item.updatedAt)}
            </p>
          </div>
        )}
        {type === "received" && (
          <div className="ml-3 flex justify-between gap-2 items-center w-full">
            <div>
              <h4 className="font-medium">{item.fullname}</h4>
            </div>
            <div>
              <Button
                size="sm"
                variant="solid"
                color="primary"
                onPress={() => contactState.acceptInvitation(item.id)}
              >
                Chấp nhận
              </Button>
              <Button
                size="sm"
                variant="light"
                className="ml-2"
                onPress={() => contactState.rejectInvitation(item.id)}
              >
                Từ chối
              </Button>
            </div>
          </div>
        )}
        {type === "sent" && (
          <div className="ml-3 flex justify-between gap-2 items-center w-full">
            <div>
              <h4 className="font-medium">{item.fullname}</h4>
            </div>
            <div>
              <Button
                size="sm"
                variant="light"
                className="ml-2"
                onPress={() => contactState.rejectInvitation(item.id)}
              >
                Huỷ lời mời
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
