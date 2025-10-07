import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    useDisclosure,
    InputOtp,
} from "@heroui/react";
import { useState } from "react";

export default function ForgotPasswordModal({
    isOpen,
    data = {},
    onClose = (data = null) => { },
    onAccept = (data = null) => { },
}: {
    isOpen: boolean;
    data?: any;
    onClose?: (data?: any) => void;
    onAccept?: (data?: any) => void;
}) {

    const [otp, setOtp] = useState("");

    const handleClose = () => {
        onClose();
    };

    const handleAccept = () => {
        if (otp.length < 6) {
            alert("Vui lòng nhập mã OTP hợp lệ.");
            return;
        }
        onAccept(otp);
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={handleClose} size="md">
                <ModalContent>
                    {() => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">Nhập mã xác nhận</ModalHeader>
                            <ModalBody className="flex justify-center">
                                <InputOtp
                                    length={6}
                                    onChange={(value) => setOtp(value as unknown as string)}
                                    autoFocus
                                    isRequired
                                />
                            </ModalBody>
                            <ModalFooter>
                                <Button color="primary" onPress={handleAccept}>
                                    Xác nhận
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </>
    );
}
