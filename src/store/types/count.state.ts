export interface CounterState {
    count: number;
    increase: () => void;
    decrease: () => void;
    getData: () => void;
}