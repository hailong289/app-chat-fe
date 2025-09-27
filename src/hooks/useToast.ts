import { addToast } from "@heroui/react"

const useToast = () => {
    const success = (message: string) => {
        addToast({
            title: "Thành công",
            description: message,
            color: "success",
        });
    };

    const error = (message: string) => {
        addToast({
            title: "Lỗi",
            description: message,
            color: "danger",
        });
    };

    const info = (message: string) => {
        addToast({
            title: "Thông tin",
            description: message,
            color: "primary",
        });
    };

    const warning = (message: string) => {
        addToast({
            title: "Cảnh báo",
            description: message,
            color: "warning",
        });
    };

    const secondary = (message: string) => {
        addToast({
            title: "Thông báo",
            description: message,
            color: "secondary",
        });
    };

    return { success, error, info, warning, secondary };
};

export default useToast;