import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";

interface InvaitationSentModalProps {
  // Define any props if needed
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onOpenChange: (isOpen: boolean) => void;
}

export default function InvaitationSentModal({
  isOpen,
  onClose,
  onOpenChange,
}: InvaitationSentModalProps) {
  const length = 5;
  return (
    <Modal isOpen={isOpen} scrollBehavior="inside" onOpenChange={onOpenChange}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Lời mời đã gửi
            </ModalHeader>
            <ModalBody>
              <h3>Đã gửi {length} lời mời kết bạn</h3>
              {/* <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam
                pulvinar risus non risus hendrerit venenatis. Pellentesque sit
                amet hendrerit risus, sed porttitor quam.
              </p>
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam
                pulvinar risus non risus hendrerit venenatis. Pellentesque sit
                amet hendrerit risus, sed porttitor quam.
              </p>
              <p>
                Magna exercitation reprehenderit magna aute tempor cupidatat
                consequat elit dolor adipisicing. Mollit dolor eiusmod sunt ex
                incididunt cillum quis. Velit duis sit officia eiusmod Lorem
                aliqua enim laboris do dolor eiusmod. Et mollit incididunt nisi
                consectetur esse laborum eiusmod pariatur proident Lorem eiusmod
                et. Culpa deserunt nostrud ad veniam.
              </p>
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam
                pulvinar risus non risus hendrerit venenatis. Pellentesque sit
                amet hendrerit risus, sed porttitor quam. Magna exercitation
                reprehenderit magna aute tempor cupidatat consequat elit dolor
                adipisicing. Mollit dolor eiusmod sunt ex incididunt cillum
                quis. Velit duis sit officia eiusmod Lorem aliqua enim laboris
                do dolor eiusmod. Et mollit incididunt nisi consectetur esse
                laborum eiusmod pariatur proident Lorem eiusmod et. Culpa
                deserunt nostrud ad veniam.
              </p>
              <p>
                Mollit dolor eiusmod sunt ex incididunt cillum quis. Velit duis
                sit officia eiusmod Lorem aliqua enim laboris do dolor eiusmod.
                Et mollit incididunt nisi consectetur esse laborum eiusmod
                pariatur proident Lorem eiusmod et. Culpa deserunt nostrud ad
                veniam. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                Nullam pulvinar risus non risus hendrerit venenatis.
                Pellentesque sit amet hendrerit risus, sed porttitor quam. Magna
                exercitation reprehenderit magna aute tempor cupidatat consequat
                elit dolor adipisicing. Mollit dolor eiusmod sunt ex incididunt
                cillum quis. Velit duis sit officia eiusmod Lorem aliqua enim
                laboris do dolor eiusmod. Et mollit incididunt nisi consectetur
                esse laborum eiusmod pariatur proident Lorem eiusmod et. Culpa
                deserunt nostrud ad veniam.
              </p>
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam
                pulvinar risus non risus hendrerit venenatis. Pellentesque sit
                amet hendrerit risus, sed porttitor quam.
              </p>
              <p>
                Magna exercitation reprehenderit magna aute tempor cupidatat
                consequat elit dolor adipisicing. Mollit dolor eiusmod sunt ex
                incididunt cillum quis. Velit duis sit officia eiusmod Lorem
                aliqua enim laboris do dolor eiusmod. Et mollit incididunt nisi
                consectetur esse laborum eiusmod pariatur proident Lorem eiusmod
                et. Culpa deserunt nostrud ad veniam.
              </p>
              <p>
                Mollit dolor eiusmod sunt ex incididunt cillum quis. Velit duis
                sit officia eiusmod Lorem aliqua enim laboris do dolor eiusmod.
                Et mollit incididunt nisi consectetur esse laborum eiusmod
                pariatur proident Lorem eiusmod et. Culpa deserunt nostrud ad
                veniam. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                Nullam pulvinar risus non risus hendrerit venenatis.
                Pellentesque sit amet hendrerit risus, sed porttitor quam. Magna
                exercitation reprehenderit magna aute tempor cupidatat consequat
                elit dolor adipisicing. Mollit dolor eiusmod sunt ex incididunt
                cillum quis. Velit duis sit officia eiusmod Lorem aliqua enim
                laboris do dolor eiusmod. Et mollit incididunt nisi consectetur
                esse laborum eiusmod pariatur proident Lorem eiusmod et. Culpa
                deserunt nostrud ad veniam.
              </p> */}
            </ModalBody>
            <ModalFooter>
              {/* <Button color="danger" variant="light" onPress={onClose}>
                Close
              </Button>
              <Button color="primary" onPress={onClose}>
                Action
              </Button> */}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
