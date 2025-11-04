import { ContactType } from "@/store/types/contact.type";
import { Avatar, Badge, Button, Card, CardBody } from "@heroui/react";

interface InvaitationSentModalProps {
  readonly item: ContactType;
  readonly onPress?: () => void;
}
export default function ItemContact({
  item,
  onPress,
}: InvaitationSentModalProps) {
  return (
    <Card
      key={item.id}
      className="mb-2 shadow-none border border-teal-100 cursor-pointer"
      onPress={onPress}
    >
      <CardBody className="flex items-center py-3 flex-row" onClick={onPress}>
        <Badge content=" " color="success" placement="bottom-right">
          <Avatar
            src={item.avatar || undefined}
            name={item.fullname}
            size="md"
            isBordered
          />
        </Badge>
        <div className="ml-3">
          <h4 className="font-medium">{item.fullname}</h4>
          <p className="text-sm text-gray-500">{item.updatedAt}</p>
        </div>
      </CardBody>
    </Card>
  );
}
