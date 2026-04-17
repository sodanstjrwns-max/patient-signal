#!/usr/bin/env python3
"""
올인원 클래스 원장님 전용 비공개 리포트
Patient Signal - 실증 데이터 기반 AI 가시성 심층 분석
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os
from datetime import datetime

# ============ FONTS ============
FONT_DIR = "/usr/share/fonts/truetype/nanum/"
pdfmetrics.registerFont(TTFont('NanumSquareB', os.path.join(FONT_DIR, 'NanumSquareB.ttf')))
pdfmetrics.registerFont(TTFont('NanumSquareEB', os.path.join(FONT_DIR, 'NanumSquareEB.ttf')))
pdfmetrics.registerFont(TTFont('NanumSquareR', os.path.join(FONT_DIR, 'NanumSquareR.ttf')))
pdfmetrics.registerFont(TTFont('NanumSquareL', os.path.join(FONT_DIR, 'NanumSquareL.ttf')))
pdfmetrics.registerFont(TTFont('NanumSquareRoundB', os.path.join(FONT_DIR, 'NanumSquareRoundB.ttf')))
pdfmetrics.registerFont(TTFont('NanumSquareRoundR', os.path.join(FONT_DIR, 'NanumSquareRoundR.ttf')))
pdfmetrics.registerFont(TTFont('NanumGothicBold', os.path.join(FONT_DIR, 'NanumGothicBold.ttf')))
pdfmetrics.registerFont(TTFont('NanumGothic', os.path.join(FONT_DIR, 'NanumGothic.ttf')))

# ============ COLORS ============
PRIMARY = HexColor('#0f172a')
SECONDARY = HexColor('#1e293b')
ACCENT_BLUE = HexColor('#3b82f6')
ACCENT_INDIGO = HexColor('#6366f1')
ACCENT_PURPLE = HexColor('#8b5cf6')
ACCENT_TEAL = HexColor('#14b8a6')
ACCENT_GREEN = HexColor('#22c55e')
ACCENT_EMERALD = HexColor('#10b981')
ACCENT_ORANGE = HexColor('#f59e0b')
ACCENT_RED = HexColor('#ef4444')
ACCENT_ROSE = HexColor('#f43f5e')
ACCENT_PINK = HexColor('#ec4899')
ACCENT_CYAN = HexColor('#06b6d4')
LIGHT_BG = HexColor('#f8fafc')
CARD_BG = HexColor('#ffffff')
DARK_TEXT = HexColor('#0f172a')
MID_TEXT = HexColor('#475569')
LIGHT_TEXT = HexColor('#94a3b8')
BORDER = HexColor('#e2e8f0')

CHATGPT_COLOR = HexColor('#10a37f')
PERPLEXITY_COLOR = HexColor('#20808d')
GEMINI_COLOR = HexColor('#8e44ef')
CLAUDE_COLOR = HexColor('#d97706')

# Gold/Silver/Bronze for rankings
GOLD = HexColor('#f59e0b')
SILVER = HexColor('#94a3b8')
BRONZE = HexColor('#cd7f32')

W, H = A4  # 595 x 842

def draw_rounded_rect(c, x, y, w, h, r=8, fill_color=None, stroke_color=None, stroke_width=0.5):
    c.saveState()
    if fill_color:
        c.setFillColor(fill_color)
    if stroke_color:
        c.setStrokeColor(stroke_color)
        c.setLineWidth(stroke_width)
    p = c.beginPath()
    p.roundRect(x, y, w, h, r)
    if fill_color and stroke_color:
        c.drawPath(p, fill=1, stroke=1)
    elif fill_color:
        c.drawPath(p, fill=1, stroke=0)
    else:
        c.drawPath(p, fill=0, stroke=1)
    c.restoreState()

def draw_gradient_rect(c, x, y, w, h, color1, color2, steps=30):
    for i in range(steps):
        ratio = i / steps
        r = color1.red + (color2.red - color1.red) * ratio
        g = color1.green + (color2.green - color1.green) * ratio
        b = color1.blue + (color2.blue - color1.blue) * ratio
        c.setFillColor(HexColor('#%02x%02x%02x' % (int(r*255), int(g*255), int(b*255))))
        c.rect(x, y + h - (i+1)*h/steps, w, h/steps + 1, fill=1, stroke=0)

def draw_footer(c, page_num, total=10):
    c.saveState()
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(40, 38, W-40, 38)
    c.setFont('NanumSquareR', 6.5)
    c.setFillColor(ACCENT_RED)
    c.drawString(40, 25, "CONFIDENTIAL  |  올인원 클래스 수강생 전용")
    c.setFont('NanumSquareB', 6.5)
    c.setFillColor(ACCENT_BLUE)
    c.drawCentredString(W/2, 25, "Patient Signal  ×  Patient Funnel")
    c.setFont('NanumSquareR', 6.5)
    c.setFillColor(LIGHT_TEXT)
    c.drawRightString(W-40, 25, f"{page_num} / {total}")
    c.restoreState()

def draw_progress_bar(c, x, y, w, h, pct, color, bg_color=HexColor('#e2e8f0')):
    draw_rounded_rect(c, x, y, w, h, r=h/2, fill_color=bg_color)
    if pct > 0:
        draw_rounded_rect(c, x, y, max(w * pct, h), h, r=h/2, fill_color=color)

def draw_stat_card(c, x, y, w, h, label, value, sub="", color=ACCENT_BLUE):
    draw_rounded_rect(c, x, y, w, h, r=6, fill_color=CARD_BG, stroke_color=BORDER)
    c.saveState()
    p = c.beginPath()
    p.roundRect(x, y+h-4, w, 4, 2)
    c.clipPath(p, stroke=0)
    c.setFillColor(color)
    c.rect(x, y+h-4, w, 4, fill=1, stroke=0)
    c.restoreState()
    c.setFont('NanumSquareEB', 16)
    c.setFillColor(color)
    c.drawCentredString(x + w/2, y + h - 28, value)
    c.setFont('NanumSquareR', 7)
    c.setFillColor(MID_TEXT)
    c.drawCentredString(x + w/2, y + h - 42, label)
    if sub:
        c.setFont('NanumSquareL', 6)
        c.setFillColor(LIGHT_TEXT)
        c.drawCentredString(x + w/2, y + 5, sub)


# ============ PAGE 1: COVER ============
def page_cover(c):
    draw_gradient_rect(c, 0, 0, W, H, HexColor('#020617'), HexColor('#0f172a'))
    
    # Decorative elements
    c.saveState()
    c.setFillColor(ACCENT_INDIGO)
    c.setFillAlpha(0.06)
    c.circle(W*0.85, H*0.8, 250, fill=1, stroke=0)
    c.setFillColor(ACCENT_BLUE)
    c.setFillAlpha(0.04)
    c.circle(W*0.1, H*0.25, 200, fill=1, stroke=0)
    c.setFillColor(ACCENT_PURPLE)
    c.setFillAlpha(0.05)
    c.circle(W*0.5, H*0.1, 180, fill=1, stroke=0)
    c.restoreState()
    
    # Confidential badge
    draw_rounded_rect(c, W/2 - 90, H - 100, 180, 26, r=13, fill_color=HexColor('#1e1b4b'), stroke_color=ACCENT_RED, stroke_width=1)
    c.setFont('NanumSquareEB', 8)
    c.setFillColor(ACCENT_RED)
    c.drawCentredString(W/2, H - 92, "CONFIDENTIAL  —  비공개 리포트")
    
    # Top line
    c.setFont('NanumSquareRoundR', 9)
    c.setFillColor(HexColor('#64748b'))
    c.drawCentredString(W/2, H - 140, "Patient Signal  ×  Patient Funnel  올인원 클래스")
    
    # Accent line
    c.setStrokeColor(ACCENT_INDIGO)
    c.setLineWidth(2)
    c.line(W/2 - 50, H - 155, W/2 + 50, H - 155)
    
    # Title
    c.setFont('NanumSquareEB', 14)
    c.setFillColor(ACCENT_BLUE)
    c.drawCentredString(W/2, H - 190, "실증 데이터 기반")
    
    c.setFont('NanumSquareEB', 36)
    c.setFillColor(white)
    c.drawCentredString(W/2, H - 240, "AI 가시성")
    c.drawCentredString(W/2, H - 288, "심층 분석 리포트")
    
    # Subtitle
    c.setFont('NanumSquareRoundR', 11)
    c.setFillColor(HexColor('#94a3b8'))
    c.drawCentredString(W/2, H - 325, "올인원 클래스 원장님만을 위한 비공개 인사이트")
    
    # Score highlight box
    box_y = H - 460
    draw_rounded_rect(c, 50, box_y, W-100, 100, r=12, fill_color=HexColor('#1e1b4b'), stroke_color=ACCENT_INDIGO, stroke_width=0.8)
    
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(ACCENT_BLUE)
    c.drawCentredString(W/2, box_y + 78, "수강생 병원 AI 가시성 핵심 수치")
    
    # 3 key stats
    stat_items = [
        ("1위 병원", "79점", GOLD),
        ("평균 점수", "31.8점", ACCENT_BLUE),
        ("TOP/BOTTOM 격차", "10.8배", ACCENT_RED),
    ]
    stat_w = (W - 140) / 3
    for i, (label, val, color) in enumerate(stat_items):
        sx = 70 + i * stat_w
        c.setFont('NanumSquareEB', 24)
        c.setFillColor(color)
        c.drawCentredString(sx + stat_w/2, box_y + 35, val)
        c.setFont('NanumSquareR', 8)
        c.setFillColor(HexColor('#94a3b8'))
        c.drawCentredString(sx + stat_w/2, box_y + 18, label)
    
    # Bottom info
    c.setFont('NanumSquareRoundB', 10)
    c.setFillColor(white)
    c.drawCentredString(W/2, 140, "Patient Signal")
    c.setFont('NanumSquareRoundR', 8)
    c.setFillColor(HexColor('#94a3b8'))
    c.drawCentredString(W/2, 124, "AI 가시성 모니터링 & 최적화 플랫폼")
    
    c.setFont('NanumSquareB', 8)
    c.setFillColor(ACCENT_BLUE)
    c.drawCentredString(W/2, 104, "https://patientsignal.co.kr")
    
    c.setFont('NanumSquareR', 7)
    c.setFillColor(HexColor('#475569'))
    c.drawCentredString(W/2, 84, f"발행일: 2026년 4월 17일  |  대상: 올인원 클래스 수강생")
    
    c.setFont('NanumSquareL', 6.5)
    c.setFillColor(HexColor('#475569'))
    c.drawCentredString(W/2, 68, "본 리포트는 Patient Signal 실사용 데이터를 기반으로 작성되었으며, 외부 유출을 금합니다.")


# ============ PAGE 2: 점수 분포 & 순위 인사이트 ============
def page_score_distribution(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    draw_gradient_rect(c, 0, H-70, W, 70, HexColor('#1e1b4b'), HexColor('#4338ca'))
    c.setFont('NanumSquareEB', 18)
    c.setFillColor(white)
    c.drawString(40, H-48, "AI 가시성 점수 분포")
    c.setFont('NanumSquareR', 9)
    c.setFillColor(HexColor('#a5b4fc'))
    c.drawRightString(W-40, H-45, "수강생 병원 실 점수 데이터")
    
    y = H - 100
    
    # Score overview cards
    cards = [
        ("1위 점수", "79점", "전체 최고", GOLD),
        ("평균", "31.8점", "중앙값 32점", ACCENT_BLUE),
        ("최저", "1점", "AI 미인식", ACCENT_RED),
        ("TOP/BOTTOM", "10.8배", "68.9 vs 6.4", ACCENT_PURPLE),
    ]
    card_w = (W - 100) / 4
    for i, (label, val, sub, color) in enumerate(cards):
        draw_stat_card(c, 40 + i*(card_w+8), y-58, card_w, 55, label, val, sub, color)
    
    y -= 78
    
    # Score distribution visualization
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "점수 구간별 분포")
    y -= 5
    
    c.setFont('NanumSquareL', 7)
    c.setFillColor(LIGHT_TEXT)
    c.drawString(40, y, "대부분의 병원이 40점 미만에 몰려 있습니다 — 지금이 선점 기회입니다")
    y -= 22
    
    # Score range bars (visual distribution)
    ranges = [
        ("70~79점", 3, ACCENT_GREEN, "상위 4%"),
        ("60~69점", 5, ACCENT_TEAL, "상위 10%"),
        ("50~59점", 4, ACCENT_BLUE, "상위 16%"),
        ("40~49점", 8, ACCENT_INDIGO, "상위 26%"),
        ("30~39점", 14, ACCENT_PURPLE, "평균 구간"),
        ("20~29점", 12, ACCENT_ORANGE, "하위 50%"),
        ("10~19점", 15, ACCENT_ROSE, "하위 35%"),
        ("1~9점", 17, ACCENT_RED, "AI 미인식"),
    ]
    
    max_count = max(r[1] for r in ranges)
    for label, count, color, note in ranges:
        c.setFont('NanumSquareR', 7.5)
        c.setFillColor(DARK_TEXT)
        c.drawString(50, y, label)
        
        bar_w = (W - 260) * count / max_count
        draw_rounded_rect(c, 120, y - 2, bar_w, 13, r=3, fill_color=color)
        
        c.setFont('NanumSquareB', 7)
        c.setFillColor(color)
        c.drawString(130 + bar_w, y, f"  {note}")
        y -= 19
    
    y -= 10
    
    # TOP10 vs BOTTOM10 detail
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "TOP 10 vs BOTTOM 10 결정적 차이")
    y -= 8
    
    half_w = (W - 90) / 2
    
    # TOP10 card
    draw_rounded_rect(c, 35, y-120, half_w, 118, r=8, fill_color=CARD_BG, stroke_color=ACCENT_GREEN, stroke_width=1.5)
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(ACCENT_GREEN)
    c.drawString(50, y-16, "TOP 10")
    
    top_data = [
        ("평균 점수", "68.9점"),
        ("평균 SOV", "51.1%"),
        ("멘션 빈도", "약 3배 높음"),
        ("웹사이트 보유", "30%"),
        ("네이버 보유", "20%"),
        ("전 플랫폼 멘션", "고르게 분포"),
    ]
    ty = y - 32
    for label, val in top_data:
        c.setFont('NanumSquareR', 7)
        c.setFillColor(MID_TEXT)
        c.drawString(50, ty, label)
        c.setFont('NanumSquareB', 7)
        c.setFillColor(DARK_TEXT)
        c.drawRightString(35 + half_w - 12, ty, val)
        ty -= 14
    
    # BOTTOM10 card
    bx = 35 + half_w + 20
    draw_rounded_rect(c, bx, y-120, half_w, 118, r=8, fill_color=CARD_BG, stroke_color=ACCENT_RED, stroke_width=1.5)
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(ACCENT_RED)
    c.drawString(bx + 15, y-16, "BOTTOM 10")
    
    bottom_data = [
        ("평균 점수", "6.4점"),
        ("평균 SOV", "0%"),
        ("멘션 빈도", "거의 0"),
        ("웹사이트 보유", "10%"),
        ("네이버 보유", "0%"),
        ("전 플랫폼 멘션", "전무"),
    ]
    ty = y - 32
    for label, val in bottom_data:
        c.setFont('NanumSquareR', 7)
        c.setFillColor(MID_TEXT)
        c.drawString(bx + 15, ty, label)
        c.setFont('NanumSquareB', 7)
        c.setFillColor(DARK_TEXT)
        c.drawRightString(bx + half_w - 12, ty, val)
        ty -= 14
    
    y -= 135
    
    # Critical insight box
    draw_rounded_rect(c, 35, y-55, W-70, 53, r=8, fill_color=HexColor('#fef2f2'), stroke_color=ACCENT_RED)
    c.setFont('NanumSquareEB', 9)
    c.setFillColor(ACCENT_RED)
    c.drawString(50, y-14, "원장님만 보시는 핵심 인사이트")
    c.setFont('NanumSquareR', 8)
    c.setFillColor(DARK_TEXT)
    c.drawString(50, y-30, "웹사이트+네이버 둘 다 보유 시 AI 멘션수 약 3배 → 이 두 가지만 갖춰도 상위 30% 진입 가능")
    c.setFont('NanumSquareB', 8)
    c.setFillColor(ACCENT_RED)
    c.drawString(50, y-44, "BOTTOM 10의 공통점: 네이버 보유율 0% — AI에게 아예 '존재하지 않는 병원'")
    
    draw_footer(c, 2)


# ============ PAGE 3: 플랫폼 심층 비교 (은밀한 데이터) ============
def page_deep_comparison(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    draw_gradient_rect(c, 0, H-70, W, 70, HexColor('#0c0a09'), HexColor('#292524'))
    c.setFont('NanumSquareEB', 18)
    c.setFillColor(white)
    c.drawString(40, H-48, "플랫폼 심층 비교")
    c.setFont('NanumSquareR', 9)
    c.setFillColor(ACCENT_ORANGE)
    c.drawRightString(W-40, H-45, "비공개 — 은밀한 데이터")
    
    y = H - 100
    
    # Platform comparison matrix
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "4개 플랫폼 완전 비교 매트릭스")
    y -= 22
    
    headers = ["지표", "ChatGPT", "Perplexity", "Gemini", "Claude"]
    widths = [110, 105, 105, 105, 100]
    
    draw_rounded_rect(c, 35, y-6, W-70, 20, r=4, fill_color=PRIMARY)
    cx = 40
    for h_text, w in zip(headers, widths):
        c.setFont('NanumSquareB', 7.5)
        c.setFillColor(white)
        c.drawString(cx + 4, y, h_text)
        cx += w
    y -= 22
    
    rows = [
        ["멘션율", "28.0%", "14.4%", "34.9%★", "25.2%"],
        ["1위 추천 비율", "61.9%", "71.0%★", "33.5%", "61.1%"],
        ["Sentiment V2", "+0.97★", "+0.80", "+0.94", "+0.94"],
        ["응답 길이(멘션)", "최장★", "최단", "중간", "중간"],
        ["웹 의존도", "53.6%", "49.9%", "46.7%", "66.9%★"],
        ["네이버 의존", "중간", "30%+★★", "낮음", "66.1%★"],
        ["R3 단독추천", "1위★", "2위", "4위", "3위"],
        ["R2 복수추천", "2위", "3위", "1위★", "4위"],
        ["핵심 질문유형", "INFO", "RESERVE", "COMPARE", "REVIEW"],
    ]
    
    for i, row in enumerate(rows):
        bg = HexColor('#f1f5f9') if i % 2 == 0 else CARD_BG
        c.setFillColor(bg)
        c.rect(35, y-5, W-70, 19, fill=1, stroke=0)
        cx = 40
        for j, (cell, w) in enumerate(zip(row, widths)):
            if j == 0:
                c.setFont('NanumSquareB', 7)
                c.setFillColor(DARK_TEXT)
            else:
                is_star = "★" in cell
                c.setFont('NanumSquareB' if is_star else 'NanumSquareR', 7)
                c.setFillColor(ACCENT_BLUE if is_star else MID_TEXT)
            c.drawString(cx + 4, y, cell)
            cx += w
        y -= 19
    
    y -= 5
    c.setFont('NanumSquareL', 6.5)
    c.setFillColor(LIGHT_TEXT)
    c.drawString(40, y, "★ = 해당 지표 1위  |  ★★ = 유일한 특성  |  실 수집 데이터 기반")
    
    y -= 25
    
    # Key hidden insights
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(ACCENT_RED)
    c.drawString(40, y, "일반 보고서에 없는 비공개 인사이트")
    y -= 20
    
    insights = [
        ("Perplexity 역설", 
         "멘션율은 14.4%로 최저이지만, 한번 멘션하면 71%가 1위 추천",
         "→ 낮은 진입장벽이 아닌 '높은 당첨금' 전략. 웹사이트+네이버 평점 4.5 이상이면 진입 확률 급상승",
         PERPLEXITY_COLOR),
        ("Gemini 함정", 
         "멘션율 34.9%로 최고지만, 1위 추천 비율은 33.5%로 최저",
         "→ '양은 많지만 질은 낮음'. 수십 개 병원을 나열 — 목록에 포함되는 것 자체는 쉽지만 의미 제한적",
         GEMINI_COLOR),
        ("Claude의 권위 편향",
         "웹사이트 보유 병원 멘션 66.9%로 압도적 1위 — 전문의 자격에 가장 민감",
         "→ 웹사이트에 전문의 경력+학력+논문을 상세히 기재하면 Claude 멘션 가능성 급상승",
         CLAUDE_COLOR),
        ("ChatGPT의 감성 독점",
         "Sentiment +0.97로 타 플랫폼 대비 압도적 긍정 멘션. 단독추천(R3)도 최다",
         "→ ChatGPT에서 멘션되면 '강력 추천' 형태. 브랜드 스토리+기술 디테일이 트리거",
         CHATGPT_COLOR),
    ]
    
    for title, line1, line2, color in insights:
        draw_rounded_rect(c, 35, y-55, W-70, 53, r=6, fill_color=CARD_BG, stroke_color=color, stroke_width=0.8)
        c.setFont('NanumSquareEB', 8.5)
        c.setFillColor(color)
        c.drawString(48, y-12, title)
        c.setFont('NanumSquareR', 7.5)
        c.setFillColor(DARK_TEXT)
        c.drawString(48, y-26, line1)
        c.setFont('NanumSquareB', 7)
        c.setFillColor(MID_TEXT)
        c.drawString(48, y-40, line2)
        y -= 62
    
    draw_footer(c, 3)


# ============ PAGE 4: 의도별 AI 반응 매트릭스 ============
def page_intent_matrix(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    draw_gradient_rect(c, 0, H-70, W, 70, HexColor('#312e81'), HexColor('#6366f1'))
    c.setFont('NanumSquareEB', 18)
    c.setFillColor(white)
    c.drawString(40, H-48, "환자 질문 의도별 AI 반응")
    c.setFont('NanumSquareR', 9)
    c.setFillColor(HexColor('#c7d2fe'))
    c.drawRightString(W-40, H-45, "QueryIntent × Platform 매트릭스")
    
    y = H - 100
    
    # Intent × Platform matrix
    c.setFont('NanumSquareEB', 10)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "질문 의도별 플랫폼 멘션율 (%) — 어디에 집중해야 하는가?")
    y -= 22
    
    headers = ["질문 의도", "ChatGPT", "Perplexity", "Gemini", "Claude", "최강 플랫폼"]
    widths = [95, 80, 80, 80, 80, 100]
    
    draw_rounded_rect(c, 35, y-6, W-70, 20, r=4, fill_color=PRIMARY)
    cx = 40
    for h_text, w in zip(headers, widths):
        c.setFont('NanumSquareB', 7)
        c.setFillColor(white)
        c.drawString(cx + 3, y, h_text)
        cx += w
    y -= 22
    
    intent_data = [
        ["INFORMATION", "45.2%", "22.6%", "52.8%★", "42.8%", "Gemini"],
        ["COMPARISON", "62.4%", "34.4%", "80.6%★", "78.0%", "Gemini"],
        ["REVIEW", "41.0%", "10.7%", "20.4%", "46.0%★", "Claude"],
        ["RESERVATION", "5.7%", "5.7%", "2.0%", "2.2%", "ChatGPT/Per"],
        ["FEAR", "5.7%", "1.0%", "1.3%", "4.3%", "전체 <6%"],
    ]
    
    for i, row in enumerate(intent_data):
        bg = HexColor('#f1f5f9') if i % 2 == 0 else CARD_BG
        c.setFillColor(bg)
        c.rect(35, y-5, W-70, 19, fill=1, stroke=0)
        cx = 40
        for j, (cell, w) in enumerate(zip(row, widths)):
            is_star = "★" in cell
            if j == 0:
                c.setFont('NanumSquareB', 7)
                c.setFillColor(DARK_TEXT)
            elif j == len(row) - 1:
                c.setFont('NanumSquareEB', 7)
                c.setFillColor(ACCENT_INDIGO)
            else:
                c.setFont('NanumSquareB' if is_star else 'NanumSquareR', 7)
                c.setFillColor(ACCENT_BLUE if is_star else MID_TEXT)
            c.drawString(cx + 3, y, cell)
            cx += w
        y -= 19
    
    y -= 15
    
    # Visual breakdown per intent
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "의도별 심층 해석 & 전략")
    y -= 18
    
    intent_insights = [
        ("INFORMATION (정보탐색)", ACCENT_BLUE,
         "환자가 '임플란트 과정', '교정 기간' 등을 물을 때",
         "Gemini(52.8%)와 ChatGPT(45.2%)가 주요 게이트키퍼",
         "→ 전략: 시술 상세 콘텐츠 + 전문의 프로필 + FAQ 정리"),
        ("COMPARISON (비교질문)", ACCENT_PURPLE,
         "환자가 '강남 교정 잘하는 곳', '임플란트 추천' 등을 물을 때",
         "Gemini(80.6%)가 압도적. Claude(78.0%)도 높음",
         "→ 전략: 시술별 상세 정보 + 지역 키워드 조합"),
        ("REVIEW (후기/평판)", ACCENT_ORANGE,
         "환자가 'OO치과 후기', '어디가 좋아요' 등을 물을 때",
         "Claude(46.0%)가 최강 — 후기 데이터에 가장 민감",
         "→ 전략: 구글/네이버 후기 관리 + 환자 만족도 콘텐츠"),
        ("RESERVATION (예약)", ACCENT_TEAL,
         "환자가 '진료 예약', '영업시간' 등을 물을 때",
         "전체적으로 5~6% 수준 — Perplexity만 예약 정보 참조",
         "→ 전략: 네이버/구글 영업정보 정확히 관리 + 가격 공개"),
        ("FEAR (공포/걱정)", ACCENT_RED,
         "환자가 '임플란트 아픈가요', '실패하면' 등을 물을 때",
         "전 플랫폼 <6% — AI의 사각지대!",
         "→ 기회: 블로그/영상으로 공포 해소 콘텐츠 선점 가능"),
    ]
    
    for title, color, desc1, desc2, strategy in intent_insights:
        draw_rounded_rect(c, 35, y-55, W-70, 53, r=6, fill_color=CARD_BG, stroke_color=color, stroke_width=0.5)
        
        # Color dot
        c.setFillColor(color)
        c.circle(48, y-10, 4, fill=1, stroke=0)
        
        c.setFont('NanumSquareEB', 8)
        c.setFillColor(color)
        c.drawString(56, y-12, title)
        
        c.setFont('NanumSquareR', 7)
        c.setFillColor(MID_TEXT)
        c.drawString(48, y-26, desc1)
        c.setFont('NanumSquareR', 7)
        c.setFillColor(DARK_TEXT)
        c.drawString(48, y-38, desc2)
        c.setFont('NanumSquareB', 7)
        c.setFillColor(color)
        c.drawString(48, y-50, strategy)
        y -= 62
    
    draw_footer(c, 4)


# ============ PAGE 5: 추천 깊이(R0-R3) 해석 ============
def page_recommendation_depth(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    draw_gradient_rect(c, 0, H-70, W, 70, HexColor('#064e3b'), HexColor('#059669'))
    c.setFont('NanumSquareEB', 18)
    c.setFillColor(white)
    c.drawString(40, H-48, "추천 깊이(R0-R3) 분석")
    c.setFont('NanumSquareR', 9)
    c.setFillColor(HexColor('#a7f3d0'))
    c.drawRightString(W-40, H-45, "AI가 얼마나 강하게 추천하는가")
    
    y = H - 100
    
    # R0-R3 explanation
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "추천 깊이 등급 체계")
    y -= 8
    
    levels = [
        ("R3", "단독 추천", "AI가 한 곳만 추천 — 가장 높은 가치", ACCENT_GREEN, "PSS ×5.0"),
        ("R2", "복수 추천", "여러 곳 중 하나로 추천 — 경쟁 포함", ACCENT_BLUE, "PSS ×2.0"),
        ("R1", "언급만", "이름은 나오지만 추천은 아님", ACCENT_ORANGE, "PSS ×0.5"),
        ("R0", "미추천 언급", "부정적이거나 비교 대상으로만 언급", ACCENT_RED, "PSS ×-1.0"),
    ]
    
    for code, title, desc, color, pss in levels:
        draw_rounded_rect(c, 40, y-32, W-80, 30, r=6, fill_color=CARD_BG, stroke_color=color, stroke_width=1)
        
        # Code badge
        draw_rounded_rect(c, 48, y-8, 30, 16, r=8, fill_color=color)
        c.setFont('NanumSquareEB', 8)
        c.setFillColor(white)
        c.drawCentredString(63, y-4, code)
        
        c.setFont('NanumSquareB', 8.5)
        c.setFillColor(DARK_TEXT)
        c.drawString(85, y-8, title)
        
        c.setFont('NanumSquareR', 7)
        c.setFillColor(MID_TEXT)
        c.drawString(85, y-22, desc)
        
        # PSS weight
        c.setFont('NanumSquareB', 7)
        c.setFillColor(color)
        c.drawRightString(W - 55, y-14, pss)
        
        y -= 38
    
    y -= 10
    
    # Platform × Depth distribution
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "플랫폼별 추천 깊이 분포 (멘션 기준)")
    y -= 22
    
    # Header
    headers = ["플랫폼", "R3 단독", "R2 복수", "R1 언급", "R3 비중", "특징"]
    widths = [90, 75, 75, 75, 75, 130]
    
    draw_rounded_rect(c, 35, y-6, W-70, 20, r=4, fill_color=PRIMARY)
    cx = 40
    for h_text, w in zip(headers, widths):
        c.setFont('NanumSquareB', 7)
        c.setFillColor(white)
        c.drawString(cx + 3, y, h_text)
        cx += w
    y -= 22
    
    depth_rows = [
        ["ChatGPT", "1위★", "2위", "4위", "17.8%", "단독추천 강자"],
        ["Perplexity", "2위", "3위", "3위", "33.7%★", "R3 비중 최고!"],
        ["Gemini", "4위", "1위★", "1위", "1.9%", "양은 많고 질은 낮음"],
        ["Claude", "3위", "4위", "2위", "7.1%", "권위 기반 추천"],
    ]
    
    for i, row in enumerate(depth_rows):
        bg = HexColor('#f1f5f9') if i % 2 == 0 else CARD_BG
        c.setFillColor(bg)
        c.rect(35, y-5, W-70, 19, fill=1, stroke=0)
        cx = 40
        for j, (cell, w) in enumerate(zip(row, widths)):
            is_star = "★" in cell
            if j == 0:
                c.setFont('NanumSquareB', 7)
                colors_map = {"ChatGPT": CHATGPT_COLOR, "Perplexity": PERPLEXITY_COLOR, "Gemini": GEMINI_COLOR, "Claude": CLAUDE_COLOR}
                c.setFillColor(colors_map.get(cell, DARK_TEXT))
            elif j == len(row) - 1:
                c.setFont('NanumSquareB', 7)
                c.setFillColor(ACCENT_INDIGO)
            else:
                c.setFont('NanumSquareB' if is_star else 'NanumSquareR', 7)
                c.setFillColor(ACCENT_BLUE if is_star else MID_TEXT)
            c.drawString(cx + 3, y, cell)
            cx += w
        y -= 19
    
    y -= 18
    
    # Key insight
    draw_rounded_rect(c, 35, y-65, W-70, 63, r=8, fill_color=HexColor('#ecfdf5'), stroke_color=ACCENT_GREEN)
    c.setFont('NanumSquareEB', 9)
    c.setFillColor(ACCENT_GREEN)
    c.drawString(50, y-14, "원장님이 진짜 노려야 할 것")
    c.setFont('NanumSquareR', 8)
    c.setFillColor(DARK_TEXT)
    c.drawString(50, y-30, "Perplexity의 R3 비중은 33.7%로, 멘션 3번 중 1번은 단독추천입니다.")
    c.drawString(50, y-44, "반면 Gemini의 R3 비중은 1.9% — 멘션은 많지만 '추천'은 아닙니다.")
    c.setFont('NanumSquareB', 8)
    c.setFillColor(ACCENT_GREEN)
    c.drawString(50, y-58, "결론: Perplexity 1회 멘션 ≈ Gemini 18회 멘션의 가치 (R3 기준)")
    
    y -= 80
    
    # PSS Formula
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "Patient Signal Score (PSS) 가중치 공식")
    y -= 12
    
    draw_rounded_rect(c, 35, y-80, W-70, 78, r=10, fill_color=PRIMARY)
    
    c.setFont('NanumSquareEB', 10)
    c.setFillColor(ACCENT_CYAN)
    c.drawCentredString(W/2, y-16, "PSS = 노출점수 × 의도가중치 × 깊이가중치 × 감성가중치")
    
    c.setFont('NanumSquareR', 7.5)
    c.setFillColor(HexColor('#94a3b8'))
    c.drawCentredString(W/2, y-35, "노출: ChatGPT ×1.0  |  Perplexity ×1.5  |  Gemini ×0.7  |  Claude ×1.2")
    c.drawCentredString(W/2, y-49, "의도: 예약 ×3.0  |  비교 ×2.0  |  후기 ×1.5  |  정보 ×1.0  |  공포 ×0.5")
    c.drawCentredString(W/2, y-63, "깊이: R3 ×5.0  |  R2 ×2.0  |  R1 ×0.5  |  R0 ×-1.0")
    
    draw_footer(c, 5)


# ============ PAGE 6: ChatGPT 공략 가이드라인 ============
def page_guide_chatgpt(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    draw_gradient_rect(c, 0, H-70, W, 70, HexColor('#064e3b'), HexColor('#10a37f'))
    c.setFont('NanumSquareEB', 18)
    c.setFillColor(white)
    c.drawString(40, H-48, "ChatGPT 공략 가이드라인")
    c.setFont('NanumSquareR', 9)
    c.setFillColor(HexColor('#a7f3d0'))
    c.drawRightString(W-40, H-45, "브랜드 스토리 + 기술 디테일 = 단독추천")
    
    y = H - 95
    
    # Stats summary
    cards = [
        ("멘션율", "28.0%", "4개 중 3위", CHATGPT_COLOR),
        ("1위 추천율", "61.9%", "멘션 시 61% 1위", ACCENT_BLUE),
        ("Sentiment", "+0.97", "가장 긍정적", ACCENT_GREEN),
        ("핵심 의도", "INFO", "정보탐색 45.2%", ACCENT_PURPLE),
    ]
    card_w = (W - 100) / 4
    for i, (label, val, sub, color) in enumerate(cards):
        draw_stat_card(c, 40 + i*(card_w+8), y-50, card_w, 48, label, val, sub, color)
    
    y -= 68
    
    # Core message
    draw_rounded_rect(c, 35, y-36, W-70, 34, r=6, fill_color=HexColor('#ecfdf5'), stroke_color=CHATGPT_COLOR)
    c.setFont('NanumSquareEB', 9)
    c.setFillColor(CHATGPT_COLOR)
    c.drawString(50, y-12, "ChatGPT 핵심 공식:")
    c.setFont('NanumSquareB', 9)
    c.setFillColor(DARK_TEXT)
    c.drawString(170, y-12, "전문의 자격 + 디지털 장비 + 시술별 경험 = R3(단독추천)")
    c.setFont('NanumSquareR', 7.5)
    c.setFillColor(MID_TEXT)
    c.drawString(50, y-27, "ChatGPT는 가장 길고 상세한 답변을 생성하며, 멘션 시 +0.97의 강한 긍정 sentiment로 추천합니다")
    
    y -= 48
    
    # Actionable strategies
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(CHATGPT_COLOR)
    c.drawString(40, y, "즉시 실행 가이드라인")
    y -= 18
    
    strategies = [
        ("전문의 자격 + 학력 상세 게시", 
         "웹사이트에 전문의 자격, 졸업 대학, 수련 경력, 학회 활동을 상세히 기재",
         "ChatGPT는 '서울대 출신', '전문의', '10년 경력' 같은 권위 키워드에 반응", "HIGH"),
        ("디지털 장비·기술 키워드 강조",
         "디지털 가이드, 3D CT, 네비게이션, CAD/CAM 등 첨단 기술 명시",
         "기술 키워드 포함 시 멘션 확률 상승 — ChatGPT가 기술 디테일을 중시", "HIGH"),
        ("시술별 전문 콘텐츠 제작",
         "임플란트, 교정, 보철 등 시술별 상세 설명 페이지를 개별 생성",
         "INFORMATION 의도(45.2%)에서 주로 멘션 — 정보성 콘텐츠가 핵심 트리거", "HIGH"),
        ("브랜드 스토리텔링",
         "개원 철학, 진료 방향, 환자 케어 시스템 등 브랜드 가치를 콘텐츠화",
         "ChatGPT는 단순 정보보다 '이야기'가 있는 병원을 더 강하게 추천", "MED"),
        ("COMPARISON 질문 대응",
         "'OO 잘하는 곳' 류의 비교 질문에서 멘션율 62.4%",
         "시술별 장단점, 과정 상세, 회복기간 등을 체계적으로 정리", "MED"),
        ("FEAR 영역 선점 (블루오션)",
         "'아프나요?', '실패하면?' 등 공포 질문에서 전 플랫폼 <6%",
         "AI가 아직 약한 영역 — 블로그/영상으로 공포 해소 콘텐츠 선점 가능", "LOW"),
    ]
    
    for title, line1, line2, priority in strategies:
        p_color = ACCENT_RED if priority == "HIGH" else (ACCENT_ORANGE if priority == "MED" else ACCENT_BLUE)
        draw_rounded_rect(c, 35, y-54, W-70, 52, r=6, fill_color=CARD_BG, stroke_color=BORDER)
        
        # Priority badge
        draw_rounded_rect(c, 42, y-6, 35, 14, r=7, fill_color=p_color)
        c.setFont('NanumSquareB', 6.5)
        c.setFillColor(white)
        c.drawCentredString(59.5, y-3, priority)
        
        c.setFont('NanumSquareEB', 8)
        c.setFillColor(DARK_TEXT)
        c.drawString(84, y-6, title)
        
        c.setFont('NanumSquareR', 7)
        c.setFillColor(MID_TEXT)
        c.drawString(48, y-22, line1)
        c.setFont('NanumSquareR', 7)
        c.setFillColor(MID_TEXT)
        c.drawString(48, y-34, line2)
        
        # Intent bar visualization
        c.setFont('NanumSquareB', 6.5)
        c.setFillColor(CHATGPT_COLOR)
        c.drawString(48, y-46, "")
        
        y -= 58
    
    draw_footer(c, 6)


# ============ PAGE 7: Perplexity 공략 가이드라인 ============
def page_guide_perplexity(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    draw_gradient_rect(c, 0, H-70, W, 70, HexColor('#134e5e'), HexColor('#20808d'))
    c.setFont('NanumSquareEB', 18)
    c.setFillColor(white)
    c.drawString(40, H-48, "Perplexity 공략 가이드라인")
    c.setFont('NanumSquareR', 9)
    c.setFillColor(HexColor('#99f6e4'))
    c.drawRightString(W-40, H-45, "출처 검증 + 네이버 평점 = 1위 독점")
    
    y = H - 95
    
    cards = [
        ("멘션율", "14.4%", "최저이나 최고 질", PERPLEXITY_COLOR),
        ("1위 추천율", "71.0%", "멘션=거의 1위!", ACCENT_RED),
        ("R3 비중", "33.7%", "3번 중 1번 단독!", ACCENT_GREEN),
        ("네이버 참조", "30%+", "유일한 플랫폼", ACCENT_ORANGE),
    ]
    card_w = (W - 100) / 4
    for i, (label, val, sub, color) in enumerate(cards):
        draw_stat_card(c, 40 + i*(card_w+8), y-50, card_w, 48, label, val, sub, color)
    
    y -= 68
    
    draw_rounded_rect(c, 35, y-36, W-70, 34, r=6, fill_color=HexColor('#f0fdfa'), stroke_color=PERPLEXITY_COLOR)
    c.setFont('NanumSquareEB', 9)
    c.setFillColor(PERPLEXITY_COLOR)
    c.drawString(50, y-12, "Perplexity 핵심 공식:")
    c.setFont('NanumSquareB', 9)
    c.setFillColor(DARK_TEXT)
    c.drawString(195, y-12, "웹사이트 + 네이버 평점 4.5+ + 가격 투명성 = 1위 독점")
    c.setFont('NanumSquareR', 7.5)
    c.setFillColor(MID_TEXT)
    c.drawString(50, y-27, "Perplexity는 출처 기반 검증 AI — 멘션율은 낮지만 한번 추천하면 71%가 1위, R3 비중 33.7%")
    
    y -= 48
    
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(PERPLEXITY_COLOR)
    c.drawString(40, y, "즉시 실행 가이드라인")
    y -= 18
    
    strategies = [
        ("공식 웹사이트 필수 확보",
         "Perplexity는 URL 출처를 인용하며 추천 — 웹사이트 없으면 멘션 자체가 불가",
         "웹사이트 의존도 49.9% — 출처 검증이 안 되면 AI가 추천하지 않음", "HIGH"),
        ("네이버 플레이스 최적화 (평점 4.5+)",
         "4개 플랫폼 중 유일하게 네이버 평점/리뷰를 적극 인용하는 AI",
         "네이버 참조율 30%+ — 평점, 리뷰수, 영업정보, 사진 모두 관리 필수", "HIGH"),
        ("가격/비용 정보 투명 공개",
         "가격 키워드 출현율 25.1%로 타 플랫폼 대비 2배 이상",
         "시술별 가격표, 보험 적용 여부, 비용 FAQ를 웹에 명확히 게시", "HIGH"),
        ("구조화된 데이터(Schema Markup)",
         "의료진 프로필, 진료시간, 위치, 연락처를 구조화된 HTML로 작성",
         "Perplexity는 구조화된 데이터를 우선 파싱 — 검색 최적화의 핵심", "MED"),
        ("예약 의도 대응 (영업시간/접근성)",
         "RESERVATION 의도에서 5.7% 멘션 — 영업시간, 위치, 전화번호 참조",
         "네이버/구글에 정확한 영업정보 등록 + 온라인 예약 시스템 구축", "MED"),
        ("간결한 핵심 정보 제공",
         "Perplexity는 멘션 시 오히려 응답이 짧아지는 유일한 AI",
         "핵심 정보를 간결하게 정리 — 장황한 마케팅 문구보다 팩트 중심", "LOW"),
    ]
    
    for title, line1, line2, priority in strategies:
        p_color = ACCENT_RED if priority == "HIGH" else (ACCENT_ORANGE if priority == "MED" else ACCENT_BLUE)
        draw_rounded_rect(c, 35, y-54, W-70, 52, r=6, fill_color=CARD_BG, stroke_color=BORDER)
        
        draw_rounded_rect(c, 42, y-6, 35, 14, r=7, fill_color=p_color)
        c.setFont('NanumSquareB', 6.5)
        c.setFillColor(white)
        c.drawCentredString(59.5, y-3, priority)
        
        c.setFont('NanumSquareEB', 8)
        c.setFillColor(DARK_TEXT)
        c.drawString(84, y-6, title)
        
        c.setFont('NanumSquareR', 7)
        c.setFillColor(MID_TEXT)
        c.drawString(48, y-22, line1)
        c.drawString(48, y-34, line2)
        y -= 58
    
    draw_footer(c, 7)


# ============ PAGE 8: Gemini 공략 가이드라인 ============
def page_guide_gemini(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    draw_gradient_rect(c, 0, H-70, W, 70, HexColor('#4a1d96'), HexColor('#8e44ef'))
    c.setFont('NanumSquareEB', 18)
    c.setFillColor(white)
    c.drawString(40, H-48, "Gemini 공략 가이드라인")
    c.setFont('NanumSquareR', 9)
    c.setFillColor(HexColor('#ddd6fe'))
    c.drawRightString(W-40, H-45, "키워드 다양성 + 지역 커버리지 = 노출 확보")
    
    y = H - 95
    
    cards = [
        ("멘션율", "34.9%", "전 플랫폼 최고!", GEMINI_COLOR),
        ("1위 추천율", "33.5%", "멘션 많지만 1위 낮음", ACCENT_RED),
        ("COMPARISON", "80.6%", "비교질문 압도적", ACCENT_PURPLE),
        ("R2 복수추천", "1위", "다수 병원 나열", ACCENT_BLUE),
    ]
    card_w = (W - 100) / 4
    for i, (label, val, sub, color) in enumerate(cards):
        draw_stat_card(c, 40 + i*(card_w+8), y-50, card_w, 48, label, val, sub, color)
    
    y -= 68
    
    draw_rounded_rect(c, 35, y-36, W-70, 34, r=6, fill_color=HexColor('#f5f3ff'), stroke_color=GEMINI_COLOR)
    c.setFont('NanumSquareEB', 9)
    c.setFillColor(GEMINI_COLOR)
    c.drawString(50, y-12, "Gemini 핵심 공식:")
    c.setFont('NanumSquareB', 9)
    c.setFillColor(DARK_TEXT)
    c.drawString(175, y-12, "다양한 키워드 + 지역 커버리지 + 전문의 = 노출 확보")
    c.setFont('NanumSquareR', 7.5)
    c.setFillColor(MID_TEXT)
    c.drawString(50, y-27, "Gemini는 가장 관대하게 병원을 나열하지만(34.9%), 1위 추천(33.5%)은 가장 낮음 — '목록 진입' 전략")
    
    y -= 48
    
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(GEMINI_COLOR)
    c.drawString(40, y, "즉시 실행 가이드라인")
    y -= 18
    
    strategies = [
        ("시술별 상세 FAQ 콘텐츠 제작",
         "COMPARISON(비교) 질문에서 80.6% 멘션 — 4개 플랫폼 중 압도적 1위",
         "시술 장단점, 과정, 회복기간, 주의사항 등을 체계적으로 정리", "HIGH"),
        ("진료과목 최대 다양화",
         "Gemini는 다양한 키워드에 반응 — 전문 시술 + 일반 진료 모두 커버",
         "임플란트, 교정, 보철뿐 아니라 충치, 사랑니, 잇몸, 미백까지 콘텐츠화", "HIGH"),
        ("지역 키워드 조합 확대",
         "지역명 + 시술명 조합으로 검색 커버리지 극대화",
         "'강남 임플란트', '서초 교정', '신사동 치과' 등 다양한 조합 콘텐츠", "MED"),
        ("전문의 자격 강조",
         "전문의 출현율 65.1%로 4개 플랫폼 중 최고 수준",
         "전문의 자격, 학회 활동, 임상 경험을 명확히 게시 — Gemini 알고리즘 반응", "MED"),
        ("R2→R3 전환 전략",
         "R2(복수추천)에서 압도적이지만 R3(단독)은 최저 — 차별화 포인트 필요",
         "독보적 전문성(예: 'OO 전문') 또는 특화 시술로 단독추천 유도", "MED"),
        ("Google 검색 연계",
         "Gemini = Google AI — Google 검색 최적화가 곧 Gemini 최적화",
         "Google Business Profile 완벽 관리 + 구조화된 데이터로 Google 생태계 장악", "LOW"),
    ]
    
    for title, line1, line2, priority in strategies:
        p_color = ACCENT_RED if priority == "HIGH" else (ACCENT_ORANGE if priority == "MED" else ACCENT_BLUE)
        draw_rounded_rect(c, 35, y-54, W-70, 52, r=6, fill_color=CARD_BG, stroke_color=BORDER)
        
        draw_rounded_rect(c, 42, y-6, 35, 14, r=7, fill_color=p_color)
        c.setFont('NanumSquareB', 6.5)
        c.setFillColor(white)
        c.drawCentredString(59.5, y-3, priority)
        
        c.setFont('NanumSquareEB', 8)
        c.setFillColor(DARK_TEXT)
        c.drawString(84, y-6, title)
        
        c.setFont('NanumSquareR', 7)
        c.setFillColor(MID_TEXT)
        c.drawString(48, y-22, line1)
        c.drawString(48, y-34, line2)
        y -= 58
    
    draw_footer(c, 8)


# ============ PAGE 9: Claude 공략 가이드라인 ============
def page_guide_claude(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    draw_gradient_rect(c, 0, H-70, W, 70, HexColor('#78350f'), HexColor('#d97706'))
    c.setFont('NanumSquareEB', 18)
    c.setFillColor(white)
    c.drawString(40, H-48, "Claude 공략 가이드라인")
    c.setFont('NanumSquareR', 9)
    c.setFillColor(HexColor('#fef3c7'))
    c.drawRightString(W-40, H-45, "권위 + 웹 신뢰도 + 후기 = 강력 멘션")
    
    y = H - 95
    
    cards = [
        ("멘션율", "25.2%", "4위이나 신뢰 높음", CLAUDE_COLOR),
        ("웹 의존도", "66.9%", "전 플랫폼 최고!", ACCENT_RED),
        ("REVIEW", "46.0%", "후기 질문 최강", ACCENT_GREEN),
        ("COMPARISON", "78.0%", "비교 2위(높음)", ACCENT_PURPLE),
    ]
    card_w = (W - 100) / 4
    for i, (label, val, sub, color) in enumerate(cards):
        draw_stat_card(c, 40 + i*(card_w+8), y-50, card_w, 48, label, val, sub, color)
    
    y -= 68
    
    draw_rounded_rect(c, 35, y-36, W-70, 34, r=6, fill_color=HexColor('#fffbeb'), stroke_color=CLAUDE_COLOR)
    c.setFont('NanumSquareEB', 9)
    c.setFillColor(CLAUDE_COLOR)
    c.drawString(50, y-12, "Claude 핵심 공식:")
    c.setFont('NanumSquareB', 9)
    c.setFillColor(DARK_TEXT)
    c.drawString(175, y-12, "전문의 권위 + 웹 & 네이버 존재감 + 후기 = 멘션")
    c.setFont('NanumSquareR', 7.5)
    c.setFillColor(MID_TEXT)
    c.drawString(50, y-27, "Claude는 웹사이트 보유 병원 멘션 66.9%로 압도적 — 권위와 출처를 가장 중시하는 AI")
    
    y -= 48
    
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(CLAUDE_COLOR)
    c.drawString(40, y, "즉시 실행 가이드라인")
    y -= 18
    
    strategies = [
        ("웹사이트 + 네이버 동시 확보 (최우선!)",
         "Claude 멘션의 66.9%가 웹사이트 보유 병원, 66.1%가 네이버 보유 병원에서 발생",
         "두 플랫폼 중 하나라도 없으면 Claude에서 거의 추천되지 않음", "HIGH"),
        ("전문의 권위 키워드 집중 게시",
         "Claude는 '추천' 키워드 출현율 84.5%로 최고 — 권위 기반 추천에 가장 민감",
         "졸업 대학, 전문의 자격, 수련 경력, 학회 활동, 논문 등을 웹에 상세 게시", "HIGH"),
        ("환자 후기·리뷰 적극 관리",
         "REVIEW(후기) 질문 멘션율 46.0%로 4개 플랫폼 중 최고",
         "구글/네이버 후기 관리, 환자 만족도 콘텐츠, 전후 사진(의료법 준수) 게시", "HIGH"),
        ("첨단 기술 키워드 활용",
         "3D(28.9%), 디지털(35.9%), 수술(30.1%) 등 첨단 기술 키워드에 민감",
         "디지털 가이드, 3D 스캐너, 미세현미경, 레이저 등 보유 장비 명시", "MED"),
        ("COMPARISON 질문 대응 (78.0%)",
         "비교 질문에서 Gemini(80.6%) 다음으로 높은 78.0% 멘션",
         "시술별 상세 정보 + 우리 병원만의 차별점을 체계적으로 정리", "MED"),
        ("신뢰성 콘텐츠 구축",
         "Claude는 '신뢰할 수 있는 정보원'에서 데이터를 가져오는 경향이 강함",
         "학술 자료 인용, 전문가 칼럼, 의료 가이드라인 기반 콘텐츠 제작", "LOW"),
    ]
    
    for title, line1, line2, priority in strategies:
        p_color = ACCENT_RED if priority == "HIGH" else (ACCENT_ORANGE if priority == "MED" else ACCENT_BLUE)
        draw_rounded_rect(c, 35, y-54, W-70, 52, r=6, fill_color=CARD_BG, stroke_color=BORDER)
        
        draw_rounded_rect(c, 42, y-6, 35, 14, r=7, fill_color=p_color)
        c.setFont('NanumSquareB', 6.5)
        c.setFillColor(white)
        c.drawCentredString(59.5, y-3, priority)
        
        c.setFont('NanumSquareEB', 8)
        c.setFillColor(DARK_TEXT)
        c.drawString(84, y-6, title)
        
        c.setFont('NanumSquareR', 7)
        c.setFillColor(MID_TEXT)
        c.drawString(48, y-22, line1)
        c.drawString(48, y-34, line2)
        y -= 58
    
    draw_footer(c, 9)


# ============ PAGE 10: 종합 액션플랜 + 마무리 ============
def page_action_plan(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    draw_gradient_rect(c, 0, H-70, W, 70, HexColor('#1e1b4b'), HexColor('#4338ca'))
    c.setFont('NanumSquareEB', 18)
    c.setFillColor(white)
    c.drawString(40, H-48, "종합 액션 플랜")
    c.setFont('NanumSquareR', 9)
    c.setFillColor(HexColor('#a5b4fc'))
    c.drawRightString(W-40, H-45, "올인원 클래스 원장님을 위한 즉시 실행 가이드")
    
    y = H - 100
    
    # Phase 1: Immediate (1-2주)
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(ACCENT_RED)
    c.drawString(40, y, "PHASE 1  |  즉시 실행 (1~2주)")
    y -= 6
    c.setFont('NanumSquareL', 7)
    c.setFillColor(MID_TEXT)
    c.drawString(40, y, "이것만 해도 AI 가시성 30% 이상 개선 가능")
    y -= 18
    
    phase1 = [
        ("웹사이트 구축/업데이트", "멘션 3배 차이의 결정적 요인 — BOTTOM 10의 90%가 웹사이트 미보유"),
        ("네이버 플레이스 최적화", "평점 4.5+, 영업시간, 사진, 메뉴 정확 관리 — Perplexity/Claude 핵심"),
        ("전문의 프로필 상세 게시", "학력+자격+경력+학회를 웹에 명시 — ChatGPT/Claude 멘션 트리거"),
    ]
    
    for title, desc in phase1:
        draw_rounded_rect(c, 40, y-26, W-80, 24, r=5, fill_color=CARD_BG, stroke_color=HexColor('#fecaca'))
        c.setFont('NanumSquareB', 7.5)
        c.setFillColor(ACCENT_RED)
        c.drawString(50, y-8, title)
        c.setFont('NanumSquareR', 6.5)
        c.setFillColor(MID_TEXT)
        c.drawString(50, y-20, desc)
        y -= 30
    
    y -= 8
    
    # Phase 2: Short-term (1개월)
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(ACCENT_ORANGE)
    c.drawString(40, y, "PHASE 2  |  단기 개선 (1개월)")
    y -= 6
    c.setFont('NanumSquareL', 7)
    c.setFillColor(MID_TEXT)
    c.drawString(40, y, "각 플랫폼별 특화 전략 실행")
    y -= 18
    
    phase2 = [
        ("시술별 상세 콘텐츠 제작", "Gemini(80.6%) + Claude(78.0%) — 비교 질문 대응의 핵심"),
        ("가격 투명성 확보", "Perplexity 전용 — 가격 키워드 25.1%로 타 플랫폼 2배"),
        ("Google Business Profile 최적화", "Gemini = Google AI — GBP 관리가 곧 Gemini 최적화"),
        ("환자 후기/리뷰 관리 시스템 구축", "Claude REVIEW 46.0% — 후기가 곧 AI 추천의 원료"),
    ]
    
    for title, desc in phase2:
        draw_rounded_rect(c, 40, y-26, W-80, 24, r=5, fill_color=CARD_BG, stroke_color=HexColor('#fed7aa'))
        c.setFont('NanumSquareB', 7.5)
        c.setFillColor(ACCENT_ORANGE)
        c.drawString(50, y-8, title)
        c.setFont('NanumSquareR', 6.5)
        c.setFillColor(MID_TEXT)
        c.drawString(50, y-20, desc)
        y -= 30
    
    y -= 8
    
    # Phase 3: Medium-term (3개월)
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(ACCENT_BLUE)
    c.drawString(40, y, "PHASE 3  |  중기 성장 (3개월)")
    y -= 6
    c.setFont('NanumSquareL', 7)
    c.setFillColor(MID_TEXT)
    c.drawString(40, y, "경쟁사 대비 확실한 우위 확보")
    y -= 18
    
    phase3 = [
        ("FEAR 영역 블루오션 선점", "전 플랫폼 <6% — AI 사각지대를 블로그/영상으로 선점"),
        ("구조화된 데이터(Schema) 적용", "Perplexity가 우선 파싱하는 데이터 형식 — 기술적 최적화"),
        ("브랜드 스토리텔링 콘텐츠", "ChatGPT가 '이야기'를 중시 — 개원 철학+케어 시스템 콘텐츠화"),
    ]
    
    for title, desc in phase3:
        draw_rounded_rect(c, 40, y-26, W-80, 24, r=5, fill_color=CARD_BG, stroke_color=HexColor('#bfdbfe'))
        c.setFont('NanumSquareB', 7.5)
        c.setFillColor(ACCENT_BLUE)
        c.drawString(50, y-8, title)
        c.setFont('NanumSquareR', 6.5)
        c.setFillColor(MID_TEXT)
        c.drawString(50, y-20, desc)
        y -= 30
    
    y -= 12
    
    # Bottom summary box
    draw_rounded_rect(c, 35, y-85, W-70, 83, r=10, fill_color=PRIMARY)
    
    c.setFont('NanumSquareEB', 12)
    c.setFillColor(ACCENT_CYAN)
    c.drawCentredString(W/2, y-16, "핵심 메시지")
    
    c.setFont('NanumSquareR', 8.5)
    c.setFillColor(white)
    c.drawCentredString(W/2, y-34, "웹사이트 + 네이버 플레이스 = AI 가시성의 절대 기본기")
    c.drawCentredString(W/2, y-50, "각 AI 플랫폼마다 완전히 다른 전략이 필요합니다")
    
    c.setFont('NanumSquareEB', 9)
    c.setFillColor(ACCENT_BLUE)
    c.drawCentredString(W/2, y-68, "Patient Signal로 내 병원의 AI 가시성을 실시간 모니터링하세요")
    
    y -= 100
    
    # Contact
    draw_rounded_rect(c, 35, y-42, W-70, 40, r=8, fill_color=HexColor('#1e1b4b'), stroke_color=ACCENT_INDIGO)
    c.setFont('NanumSquareEB', 10)
    c.setFillColor(white)
    c.drawCentredString(W/2, y-16, "Patient Signal  |  https://patientsignal.co.kr")
    c.setFont('NanumSquareR', 8)
    c.setFillColor(HexColor('#94a3b8'))
    c.drawCentredString(W/2, y-32, "AI 시대, 환자가 AI에게 물어보는 시대 — 우리 병원은 준비되어 있나요?")
    
    draw_footer(c, 10)


# ============ GENERATE ============
def generate():
    output_path = "/home/user/webapp/allinone_class_report.pdf"
    c = canvas.Canvas(output_path, pagesize=A4)
    c.setTitle("올인원 클래스 전용 AI 가시성 심층 분석 리포트 - Patient Signal")
    c.setAuthor("Patient Signal × Patient Funnel")
    c.setSubject("올인원 클래스 수강생 전용 비공개 리포트")
    
    page_cover(c)
    c.showPage()
    
    page_score_distribution(c)
    c.showPage()
    
    page_deep_comparison(c)
    c.showPage()
    
    page_intent_matrix(c)
    c.showPage()
    
    page_recommendation_depth(c)
    c.showPage()
    
    page_guide_chatgpt(c)
    c.showPage()
    
    page_guide_perplexity(c)
    c.showPage()
    
    page_guide_gemini(c)
    c.showPage()
    
    page_guide_claude(c)
    c.showPage()
    
    page_action_plan(c)
    c.showPage()
    
    c.save()
    print(f"PDF generated: {output_path}")
    print(f"File size: {os.path.getsize(output_path) / 1024:.1f} KB")

if __name__ == "__main__":
    generate()
