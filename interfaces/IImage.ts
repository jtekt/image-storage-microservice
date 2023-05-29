import { ObjectId } from "mongoose";

export default interface IImage {
  _id?: ObjectId,
  file: string;
  time?: Date;
  data: any;
}