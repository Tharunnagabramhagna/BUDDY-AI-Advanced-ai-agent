import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyCCV_OhhzO_46f0qtaCKCC2FV1ukh69mRs";

const genAI = new GoogleGenerativeAI(API_KEY);

export async function askBuddy(prompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent(prompt);
  const response = result.response;

  return response.text();
}