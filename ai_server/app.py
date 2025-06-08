from fastapi import FastAPI, Request
from pydantic import BaseModel
import torch
from my_model import load_model, analyze_text  # your teammate should write these

app = FastAPI()
model, tokenizer = load_model()

class AnalyzeRequest(BaseModel):
    text: str

@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    result = analyze_text(request.text, model, tokenizer)
    return result
