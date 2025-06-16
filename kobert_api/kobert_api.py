# KoBERT model load 및 logit + threshold 조정 FastAPI 파이썬 파일
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, BertModel
import torch
import torch.nn as nn
import torch.nn.functional as F

# 모델 정의
# head1 - 괴롭힘 여부 이진 분류
class Head1(nn.Module):
    def __init__(self):
        super().__init__()
        self.bert = BertModel.from_pretrained("skt/kobert-base-v1")
        self.classifier = nn.Linear(self.bert.config.hidden_size, 1)

    def forward(self, input_ids, attention_mask):
        return self.classifier(self.bert(input_ids, attention_mask).pooler_output)

# head2 - 괴롭힘 유형 다중 분류
class Head2(nn.Module):
    def __init__(self):
        super().__init__()
        self.bert = BertModel.from_pretrained("skt/kobert-base-v1")
        self.classifier = nn.Linear(self.bert.config.hidden_size, 7)

    def forward(self, input_ids, attention_mask):
        return self.classifier(self.bert(input_ids, attention_mask).pooler_output)

# head3 - 괴롭힘 심각도 등급 분류
class Head3(nn.Module):
    def __init__(self):
        super().__init__()
        self.bert = BertModel.from_pretrained("skt/kobert-base-v1")
        self.classifier = nn.Linear(self.bert.config.hidden_size, 1)

    def forward(self, input_ids, attention_mask):
        return self.classifier(self.bert(input_ids, attention_mask).pooler_output)
    
# 환경 세팅
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
# 괴롭힘 유형 다중 분류 - 7유형 지정정
LABELS = ["DISCRIMINATION", "HATE", "CENSURE", "VIOLENCE", "CRIME", "SEXUAL", "ABUSE"]

# model load
model1 = Head1().to(device)
model2 = Head2().to(device)
model3 = Head3().to(device)

model1.load_state_dict(torch.load("kobert_api/model_head1.pt", map_location=device))
model2.load_state_dict(torch.load("kobert_api/model_head2.pt", map_location=device))
model3.load_state_dict(torch.load("kobert_api/model_head3.pt", map_location=device))
model1.eval()
model2.eval()
model3.eval()

# tokenizer
tokenizer = AutoTokenizer.from_pretrained("kobert_api/kobert_tokenizer", use_fast=False, local_files_only=True)
# FastAPI server
app = FastAPI()

class RequestText(BaseModel):
    text: str

@app.post("/analyze")
def analyze(data: RequestText):
    inputs = tokenizer(data.text, return_tensors="pt", padding="max_length", truncation=True, max_length=96)
    input_ids = inputs["input_ids"].to(device)
    attention_mask = inputs["attention_mask"].to(device)

    # head1 
    logit1 = model1(input_ids, attention_mask).squeeze() * 0.4
    sigmoid1 = torch.sigmoid(logit1).item()
    is_immoral = int(sigmoid1 > 0.61)
    print("🔍 logit1:", logit1.item(), "| sigmoid:", sigmoid1)

    if is_immoral == 0:
        types = []
        severity = -1
    else:
        # head2
        logits2 = model2(input_ids, attention_mask).squeeze()
        logits2[5] *= 0.1
        probs2 = torch.sigmoid(logits2)
        # 클래스 별 threshold 설정
        custom_threshold = [0.25, 0.25, 0.25, 0.25, 0.25, 0.566, 0.25]
        types = [LABELS[i] for i, p in enumerate(probs2) if p > custom_threshold[i]]

        print("🔍 logits2:", logits2.tolist())
        print("🔍 probs2:", probs2.tolist())
        print("🔍 selected types:", types)

        # head3
        logit3 = model3(input_ids, attention_mask).squeeze() * 0.56
        sigmoid3 = torch.sigmoid(logit3).item()
        severity = int(sigmoid3 > 0.5)

        print("🔍 logit3:", logit3.item(), "| sigmoid:", sigmoid3)

    return {
        "harassment": is_immoral,
        "types": types,
        "severity": severity
    }