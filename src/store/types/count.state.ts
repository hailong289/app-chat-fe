export interface CounterState {
  count: number;
  //   increase: () => void;
  //   decrease: () => void;
  //   getData: () => void;
  isToggled: boolean;
  collapsedSidebar: boolean;
  setToggleState: (value: boolean) => void;
  tab: string;
  setTab: (tab: string) => void;
  togoleSidebar: () => void;
}
