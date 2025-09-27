import { parseDate } from "@internationalized/date";

class Helpers {
    static getDefaultDate = () => {
        const today = new Date();
        const eighteenYearsAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        return parseDate(eighteenYearsAgo.toISOString().split('T')[0]);
    };
}

export default Helpers;