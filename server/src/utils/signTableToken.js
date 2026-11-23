import { nanoid } from 'nanoid';

export const signTableToken = () => {
  return `tbl_${nanoid(20)}`;
};
