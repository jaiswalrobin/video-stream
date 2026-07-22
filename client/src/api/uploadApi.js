import axios from "axios";
import { getApiUrl } from "../config/env";

const api = axios.create({
  baseURL: getApiUrl("/api"),
});

export const initiateUpload = (payload) =>
  api.post("/uploads/initiate", payload);

export const completeUpload = (payload) =>
  api.post("/uploads/complete", payload);
