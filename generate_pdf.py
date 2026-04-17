#!/usr/bin/env python3
"""
AI 플랫폼별 공략 전략 PDF 리포트 생성
Patient Signal - AI 플랫폼별 공략 전략 리포트
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
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
PRIMARY = HexColor('#1a1a2e')
ACCENT_BLUE = HexColor('#4361ee')
ACCENT_PURPLE = HexColor('#7209b7')
ACCENT_TEAL = HexColor('#0ea5e9')
ACCENT_GREEN = HexColor('#10b981')
ACCENT_ORANGE = HexColor('#f59e0b')
ACCENT_RED = HexColor('#ef4444')
ACCENT_PINK = HexColor('#ec4899')
LIGHT_BG = HexColor('#f8fafc')
CARD_BG = HexColor('#ffffff')
DARK_TEXT = HexColor('#1e293b')
MID_TEXT = HexColor('#475569')
LIGHT_TEXT = HexColor('#94a3b8')
CHATGPT_COLOR = HexColor('#10a37f')
PERPLEXITY_COLOR = HexColor('#20808d')
GEMINI_COLOR = HexColor('#8e44ef')
CLAUDE_COLOR = HexColor('#d97706')

W, H = A4  # 595 x 842

def draw_rounded_rect(c, x, y, w, h, r=8, fill_color=None, stroke_color=None, stroke_width=0.5):
    """Draw a rounded rectangle"""
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
    """Simple vertical gradient"""
    for i in range(steps):
        ratio = i / steps
        r = color1.red + (color2.red - color1.red) * ratio
        g = color1.green + (color2.green - color1.green) * ratio
        b = color1.blue + (color2.blue - color1.blue) * ratio
        c.setFillColor(HexColor('#%02x%02x%02x' % (int(r*255), int(g*255), int(b*255))))
        c.rect(x, y + h - (i+1)*h/steps, w, h/steps + 1, fill=1, stroke=0)

def draw_footer(c, page_num):
    """Common footer for all pages"""
    c.saveState()
    # Footer line
    c.setStrokeColor(HexColor('#e2e8f0'))
    c.setLineWidth(0.5)
    c.line(40, 38, W-40, 38)
    # Left: brand
    c.setFont('NanumSquareR', 7)
    c.setFillColor(LIGHT_TEXT)
    c.drawString(40, 25, "Patient Signal  |  AI 가시성 모니터링 플랫폼")
    # Center: URL
    c.setFont('NanumSquareB', 7)
    c.setFillColor(ACCENT_BLUE)
    c.drawCentredString(W/2, 25, "https://patientsignal.co.kr")
    # Right: page
    c.setFont('NanumSquareR', 7)
    c.setFillColor(LIGHT_TEXT)
    c.drawRightString(W-40, 25, f"Page {page_num}")
    c.restoreState()

def draw_section_badge(c, x, y, text, color):
    """Draw a colored badge/pill"""
    tw = c.stringWidth(text, 'NanumSquareB', 8) + 16
    draw_rounded_rect(c, x, y-4, tw, 18, r=9, fill_color=color)
    c.setFont('NanumSquareB', 8)
    c.setFillColor(white)
    c.drawString(x + 8, y, text)
    return tw

def draw_stat_card(c, x, y, w, h, label, value, sub="", color=ACCENT_BLUE):
    """Draw a stat card with number"""
    draw_rounded_rect(c, x, y, w, h, r=6, fill_color=CARD_BG, stroke_color=HexColor('#e2e8f0'))
    # Color bar on top
    c.saveState()
    p = c.beginPath()
    p.roundRect(x, y+h-4, w, 4, 2)
    c.clipPath(p, stroke=0)
    c.setFillColor(color)
    c.rect(x, y+h-4, w, 4, fill=1, stroke=0)
    c.restoreState()
    # Value
    c.setFont('NanumSquareEB', 18)
    c.setFillColor(color)
    c.drawCentredString(x + w/2, y + h - 30, value)
    # Label
    c.setFont('NanumSquareR', 7.5)
    c.setFillColor(MID_TEXT)
    c.drawCentredString(x + w/2, y + h - 44, label)
    # Sub
    if sub:
        c.setFont('NanumSquareL', 6.5)
        c.setFillColor(LIGHT_TEXT)
        c.drawCentredString(x + w/2, y + 6, sub)

def draw_progress_bar(c, x, y, w, h, pct, color, bg_color=HexColor('#e2e8f0')):
    """Draw a progress bar"""
    draw_rounded_rect(c, x, y, w, h, r=h/2, fill_color=bg_color)
    if pct > 0:
        draw_rounded_rect(c, x, y, max(w * pct, h), h, r=h/2, fill_color=color)

def draw_table_row(c, x, y, cols, widths, font='NanumSquareR', size=7.5, colors=None, bg=None, height=20):
    """Draw a table row"""
    if bg:
        c.setFillColor(bg)
        c.rect(x, y-4, sum(widths), height, fill=1, stroke=0)
    cx = x
    for i, (col, w) in enumerate(zip(cols, widths)):
        color = colors[i] if colors else DARK_TEXT
        c.setFont(font, size)
        c.setFillColor(color)
        c.drawString(cx + 6, y+2, str(col))
        cx += w


# ============ PAGE 1: COVER ============
def page_cover(c):
    # Full background gradient
    draw_gradient_rect(c, 0, 0, W, H, HexColor('#0f0f23'), HexColor('#1a1a3e'))
    
    # Decorative circles
    c.saveState()
    c.setFillColor(HexColor('#4361ee'))
    c.setFillAlpha(0.08)
    c.circle(W*0.8, H*0.85, 200, fill=1, stroke=0)
    c.circle(W*0.15, H*0.2, 150, fill=1, stroke=0)
    c.setFillColor(HexColor('#7209b7'))
    c.setFillAlpha(0.06)
    c.circle(W*0.6, H*0.15, 180, fill=1, stroke=0)
    c.restoreState()
    
    # Top badge
    c.setFont('NanumSquareRoundR', 9)
    c.setFillColor(HexColor('#94a3b8'))
    c.drawCentredString(W/2, H - 120, "DATA-DRIVEN AEO STRATEGY REPORT")
    
    # Accent line
    c.setStrokeColor(ACCENT_BLUE)
    c.setLineWidth(2)
    c.line(W/2 - 40, H - 135, W/2 + 40, H - 135)
    
    # Main title
    c.setFont('NanumSquareEB', 36)
    c.setFillColor(white)
    c.drawCentredString(W/2, H - 200, "AI 플랫폼별")
    c.drawCentredString(W/2, H - 248, "공략 전략 리포트")
    
    # Subtitle
    c.setFont('NanumSquareRoundR', 13)
    c.setFillColor(HexColor('#94a3b8'))
    c.drawCentredString(W/2, H - 290, "대규모 AI 응답 데이터 기반 실전 가이드")
    
    # 4 platform cards
    platforms = [
        ("ChatGPT", "27.9%", "멘션율", CHATGPT_COLOR),
        ("Perplexity", "14.7%", "멘션율", PERPLEXITY_COLOR),
        ("Gemini", "35.4%", "멘션율", GEMINI_COLOR),
        ("Claude", "25.3%", "멘션율", CLAUDE_COLOR),
    ]
    card_w = 110
    card_h = 80
    start_x = (W - (card_w * 4 + 15 * 3)) / 2
    card_y = H - 420
    
    for i, (name, rate, label, color) in enumerate(platforms):
        cx = start_x + i * (card_w + 15)
        # Card bg - solid dark with border
        draw_rounded_rect(c, cx, card_y, card_w, card_h, r=10, fill_color=HexColor('#1e1e3a'), stroke_color=HexColor('#334155'), stroke_width=0.5)
        
        # Color accent bar on top
        c.saveState()
        p = c.beginPath()
        p.roundRect(cx, card_y + card_h - 4, card_w, 4, 2)
        c.clipPath(p, stroke=0)
        c.setFillColor(color)
        c.rect(cx, card_y + card_h - 4, card_w, 4, fill=1, stroke=0)
        c.restoreState()
        
        # Platform name
        c.setFont('NanumSquareB', 10)
        c.setFillColor(color)
        c.drawCentredString(cx + card_w/2, card_y + card_h - 24, name)
        
        # Rate
        c.setFont('NanumSquareEB', 22)
        c.setFillColor(white)
        c.drawCentredString(cx + card_w/2, card_y + 22, rate)
        
        # Label
        c.setFont('NanumSquareL', 7)
        c.setFillColor(HexColor('#94a3b8'))
        c.drawCentredString(cx + card_w/2, card_y + 8, label)
    
    # Bottom info
    c.setFont('NanumSquareRoundB', 11)
    c.setFillColor(white)
    c.drawCentredString(W/2, 130, "Patient Signal")
    
    c.setFont('NanumSquareRoundR', 9)
    c.setFillColor(HexColor('#94a3b8'))
    c.drawCentredString(W/2, 112, "AI 가시성 모니터링 & 최적화 플랫폼")
    
    c.setFont('NanumSquareB', 9)
    c.setFillColor(ACCENT_BLUE)
    c.drawCentredString(W/2, 92, "https://patientsignal.co.kr")
    
    c.setFont('NanumSquareR', 8)
    c.setFillColor(HexColor('#64748b'))
    c.drawCentredString(W/2, 72, f"발행일: 2026년 4월 14일")

    c.setFont('NanumSquareL', 7)
    c.setFillColor(HexColor('#475569'))
    c.drawCentredString(W/2, 52, "본 리포트의 데이터는 Patient Signal 플랫폼에서 실제 수집된 데이터를 기반으로 합니다.")


# ============ PAGE 2: EXECUTIVE SUMMARY ============
def page_executive_summary(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    # Header bar
    draw_gradient_rect(c, 0, H-70, W, 70, HexColor('#1a1a2e'), HexColor('#2d2d5e'))
    c.setFont('NanumSquareEB', 18)
    c.setFillColor(white)
    c.drawString(40, H-48, "Executive Summary")
    c.setFont('NanumSquareR', 9)
    c.setFillColor(HexColor('#94a3b8'))
    c.drawRightString(W-40, H-45, "핵심 발견 요약")
    
    y = H - 110
    
    # Key Finding 1
    draw_rounded_rect(c, 35, y-68, W-70, 65, r=8, fill_color=CARD_BG, stroke_color=HexColor('#e2e8f0'))
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(ACCENT_BLUE)
    c.drawString(50, y-18, "핵심 발견 #1")
    c.setFont('NanumSquareR', 9)
    c.setFillColor(DARK_TEXT)
    c.drawString(50, y-35, "웹사이트 + 네이버 플레이스 둘 다 보유한 병원은 AI 멘션수가 3배 높다")
    c.setFont('NanumSquareL', 8)
    c.setFillColor(MID_TEXT)
    c.drawString(50, y-50, "웹+네이버 둘 다 보유 병원의 AI 멘션수가 미보유 병원 대비 약 3배 — 가시성 격차 극명")
    y -= 82
    
    # Key Finding 2
    draw_rounded_rect(c, 35, y-68, W-70, 65, r=8, fill_color=CARD_BG, stroke_color=HexColor('#e2e8f0'))
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(ACCENT_PURPLE)
    c.drawString(50, y-18, "핵심 발견 #2")
    c.setFont('NanumSquareR', 9)
    c.setFillColor(DARK_TEXT)
    c.drawString(50, y-35, "Gemini가 가장 관대(35.4%)하지만, Perplexity는 한번 멘션하면 70%가 1위 추천")
    c.setFont('NanumSquareL', 8)
    c.setFillColor(MID_TEXT)
    c.drawString(50, y-50, "각 플랫폼마다 완전히 다른 전략이 필요 — 하나의 SEO로는 AI 시대에 대응 불가")
    y -= 82
    
    # Key Finding 3
    draw_rounded_rect(c, 35, y-68, W-70, 65, r=8, fill_color=CARD_BG, stroke_color=HexColor('#e2e8f0'))
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(ACCENT_GREEN)
    c.drawString(50, y-18, "핵심 발견 #3")
    c.setFont('NanumSquareR', 9)
    c.setFillColor(DARK_TEXT)
    c.drawString(50, y-35, "COMPARISON(비교) 질문에서 Gemini 81%, Claude 78% 멘션 — 시술별 상세 정보가 핵심")
    c.setFont('NanumSquareL', 8)
    c.setFillColor(MID_TEXT)
    c.drawString(50, y-50, "반면 FEAR(공포/걱정) 질문은 전 플랫폼 5% 미만 — AI가 아직 못하는 영역")
    y -= 82
    
    # Key Finding 4
    draw_rounded_rect(c, 35, y-68, W-70, 65, r=8, fill_color=CARD_BG, stroke_color=HexColor('#e2e8f0'))
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(ACCENT_ORANGE)
    c.drawString(50, y-18, "핵심 발견 #4")
    c.setFont('NanumSquareR', 9)
    c.setFillColor(DARK_TEXT)
    c.drawString(50, y-35, "Claude는 웹사이트 보유 병원 멘션 비율 66.9% — 권위 기반 추천에 가장 민감")
    c.setFont('NanumSquareL', 8)
    c.setFillColor(MID_TEXT)
    c.drawString(50, y-50, "ChatGPT 53.6%, Perplexity 49.9%, Gemini 46.7% 순. Claude 공략 = 웹 권위 확보")
    y -= 95

    # Platform comparison table
    c.setFont('NanumSquareEB', 12)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "플랫폼별 핵심 지표 비교")
    y -= 25

    headers = ["지표", "ChatGPT", "Perplexity", "Gemini", "Claude"]
    widths = [120, 100, 100, 100, 100]
    
    # Header row
    draw_rounded_rect(c, 35, y-6, W-70, 22, r=4, fill_color=PRIMARY)
    cx = 40
    for h_text, w in zip(headers, widths):
        c.setFont('NanumSquareB', 8)
        c.setFillColor(white)
        c.drawString(cx + 6, y, h_text)
        cx += w
    y -= 24
    
    rows = [
        ["멘션율", "27.9%", "14.7%", "35.4% (최고)", "25.3%"],
        ["1위 추천 비율", "61.2%", "70.2% (최고)", "33.3%", "60.7%"],
        ["R3 단독추천", "최다", "2위", "최저", "3위"],
        ["Sentiment V2", "+0.97 (최고)", "+0.79", "+0.94", "+0.94"],
        ["응답 길이 (멘션)", "최장", "최단", "중간", "중간"],
        ["웹사이트 의존도", "53.6%", "49.9%", "46.7%", "66.9% (최고)"],
        ["핵심 질문유형", "INFORMATION", "RESERVATION", "COMPARISON", "REVIEW"],
    ]
    
    for i, row in enumerate(rows):
        bg = HexColor('#f1f5f9') if i % 2 == 0 else CARD_BG
        c.setFillColor(bg)
        c.rect(35, y-6, W-70, 22, fill=1, stroke=0)
        cx = 40
        for j, (cell, w) in enumerate(zip(row, widths)):
            if j == 0:
                c.setFont('NanumSquareB', 7.5)
                c.setFillColor(DARK_TEXT)
            else:
                is_best = "(최고)" in cell or "(최다)" in cell or "(최장)" in cell
                c.setFont('NanumSquareB' if is_best else 'NanumSquareR', 7.5)
                c.setFillColor(ACCENT_BLUE if is_best else MID_TEXT)
            c.drawString(cx + 6, y, cell)
            cx += w
        y -= 22
    
    draw_footer(c, 2)


# ============ PAGE 3: ChatGPT ============
def page_chatgpt(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    # Header
    draw_gradient_rect(c, 0, H-70, W, 70, HexColor('#064e3b'), HexColor('#10a37f'))
    c.setFont('NanumSquareEB', 20)
    c.setFillColor(white)
    c.drawString(40, H-48, "ChatGPT 공략법")
    c.setFont('NanumSquareR', 10)
    c.setFillColor(HexColor('#a7f3d0'))
    c.drawRightString(W-40, H-45, "브랜드 스토리텔링 + 기술 디테일")
    
    y = H - 100
    
    # Stat cards
    cards = [
        ("멘션율", "27.9%", "4개 플랫폼 중 3위", CHATGPT_COLOR),
        ("R3 단독추천", "최다", "전 플랫폼 1위", ACCENT_RED),
        ("Sentiment", "+0.97", "가장 긍정적 멘션", ACCENT_GREEN),
        ("응답 길이", "최장", "가장 상세한 설명", ACCENT_BLUE),
    ]
    card_w = (W - 100) / 4
    for i, (label, val, sub, color) in enumerate(cards):
        draw_stat_card(c, 40 + i*(card_w+8), y-58, card_w, 55, label, val, sub, color)
    
    y -= 80
    
    # Key insight box
    draw_rounded_rect(c, 35, y-70, W-70, 68, r=8, fill_color=HexColor('#ecfdf5'), stroke_color=CHATGPT_COLOR, stroke_width=1)
    c.setFont('NanumSquareEB', 10)
    c.setFillColor(CHATGPT_COLOR)
    c.drawString(50, y-18, "ChatGPT의 특성")
    c.setFont('NanumSquareR', 8.5)
    c.setFillColor(DARK_TEXT)
    c.drawString(50, y-34, "ChatGPT는 가장 길고 자세한 응답을 생성하며, 단독추천(R3)이 가장 많습니다.")
    c.drawString(50, y-48, "브랜드 인지도와 기술 디테일을 중시하며, 멘션 시 sentiment가 +0.97로 가장 긍정적입니다.")
    c.drawString(50, y-62, "INFORMATION(정보탐색) 의도에서 81%의 멘션이 발생 — 정보성 콘텐츠가 핵심입니다.")
    
    y -= 88
    
    # Intent distribution
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "질문 의도별 멘션율")
    y -= 20
    
    intents = [
        ("COMPARISON (비교)", 60.5, ACCENT_PURPLE),
        ("INFORMATION (정보)", 45.1, ACCENT_BLUE),
        ("REVIEW (후기)", 40.0, ACCENT_ORANGE),
        ("RESERVATION (예약)", 5.8, ACCENT_TEAL),
        ("FEAR (공포/걱정)", 6.3, ACCENT_RED),
    ]
    for label, pct, color in intents:
        c.setFont('NanumSquareR', 8)
        c.setFillColor(DARK_TEXT)
        c.drawString(50, y, label)
        draw_progress_bar(c, 200, y-2, 250, 12, pct/100, color)
        c.setFont('NanumSquareB', 8)
        c.setFillColor(color)
        c.drawString(460, y, f"{pct}%")
        y -= 20
    
    y -= 15
    
    # Position distribution
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "멘션 포지션 분포")
    y -= 18
    
    c.setFont('NanumSquareR', 8)
    c.setFillColor(MID_TEXT)
    c.drawString(50, y, "1위: 61.2%  |  2위: 15.3%  |  3위: 8.2%  |  4위+: 15.3%")
    y -= 8

    # Visual bar for positions
    y -= 18
    pos_data = [(61.2, "1위", CHATGPT_COLOR), (15.3, "2위", HexColor('#34d399')), (8.2, "3위", HexColor('#6ee7b7')), (15.3, "4위+", HexColor('#a7f3d0'))]
    total_pos = sum(p[0] for p in pos_data)
    bar_x = 50
    for pct, label, color in pos_data:
        bar_w = (W - 120) * pct / total_pos
        draw_rounded_rect(c, bar_x, y, bar_w-2, 16, r=3, fill_color=color)
        if bar_w > 40:
            c.setFont('NanumSquareB', 7)
            c.setFillColor(white)
            c.drawCentredString(bar_x + bar_w/2, y+4, f"{label} {pct}%")
        bar_x += bar_w
    
    y -= 35
    
    # Strategy section
    c.setFont('NanumSquareEB', 12)
    c.setFillColor(CHATGPT_COLOR)
    c.drawString(40, y, "실전 공략 전략")
    y -= 22
    
    strategies = [
        ("1. 진료과목 구체화", "임플란트, 교정 등 전문 시술명을 콘텐츠에 명시 → 멘션율 +20% 차이"),
        ("2. 디지털 장비/기술 강조", "디지털 가이드, 3D CT, 네비게이션 등 기술 키워드 → 멘션 확률 +15%"),
        ("3. INFORMATION 질문 집중", "정보탐색 질문에서 81% 멘션 발생 — 전문 정보성 콘텐츠 제작"),
        ("4. 전문성 > 비용/후기", "비용, 후기보다 전문의 자격 + 장비 + 경험수 강조가 효과적"),
    ]
    
    for title, desc in strategies:
        draw_rounded_rect(c, 40, y-30, W-80, 28, r=6, fill_color=CARD_BG, stroke_color=HexColor('#d1fae5'))
        c.setFont('NanumSquareB', 8.5)
        c.setFillColor(CHATGPT_COLOR)
        c.drawString(52, y-10, title)
        c.setFont('NanumSquareR', 7.5)
        c.setFillColor(MID_TEXT)
        c.drawString(52, y-23, desc)
        y -= 36
    
    y -= 10
    
    # Formula box
    draw_rounded_rect(c, 40, y-38, W-80, 36, r=8, fill_color=HexColor('#064e3b'))
    c.setFont('NanumSquareEB', 10)
    c.setFillColor(white)
    c.drawCentredString(W/2, y-16, "ChatGPT 공식")
    c.setFont('NanumSquareB', 9)
    c.setFillColor(HexColor('#a7f3d0'))
    c.drawCentredString(W/2, y-30, "전문의 자격 + 디지털 장비 + 시술별 경험수 = 단독추천(R3)")
    
    draw_footer(c, 3)


# ============ PAGE 4: Perplexity ============
def page_perplexity(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    # Header
    draw_gradient_rect(c, 0, H-70, W, 70, HexColor('#134e5e'), HexColor('#20808d'))
    c.setFont('NanumSquareEB', 20)
    c.setFillColor(white)
    c.drawString(40, H-48, "Perplexity 공략법")
    c.setFont('NanumSquareR', 10)
    c.setFillColor(HexColor('#99f6e4'))
    c.drawRightString(W-40, H-45, "웹 출처 + 네이버 평점 최적화")
    
    y = H - 100
    
    cards = [
        ("멘션율", "14.7%", "최저 — but 질이 높음", PERPLEXITY_COLOR),
        ("1위 추천율", "70.2%", "멘션하면 거의 1위!", ACCENT_RED),
        ("R3 단독추천", "최상위", "ChatGPT급 품질", ACCENT_GREEN),
        ("네이버 참조", "30%+", "유일하게 네이버 참조", ACCENT_ORANGE),
    ]
    card_w = (W - 100) / 4
    for i, (label, val, sub, color) in enumerate(cards):
        draw_stat_card(c, 40 + i*(card_w+8), y-58, card_w, 55, label, val, sub, color)
    
    y -= 80
    
    # Key insight
    draw_rounded_rect(c, 35, y-70, W-70, 68, r=8, fill_color=HexColor('#f0fdfa'), stroke_color=PERPLEXITY_COLOR, stroke_width=1)
    c.setFont('NanumSquareEB', 10)
    c.setFillColor(PERPLEXITY_COLOR)
    c.drawString(50, y-18, "Perplexity의 특성")
    c.setFont('NanumSquareR', 8.5)
    c.setFillColor(DARK_TEXT)
    c.drawString(50, y-34, "Perplexity는 출처 기반 검증 AI로, 멘션율은 14.7%로 가장 낮지만 한번 멘션하면 70%가 1위입니다.")
    c.drawString(50, y-48, "미멘션 시 응답이 더 길고, 멘션 시 오히려 간결 — 핵심만 추천하는 스타일입니다.")
    c.drawString(50, y-62, "유일하게 네이버 플레이스를 적극 참조하며, 가격/비용 정보에 민감합니다.")
    
    y -= 88
    
    # Unique characteristics
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "Perplexity만의 독특한 패턴")
    y -= 25
    
    patterns = [
        ("웹사이트 의존도 49.9%", "웹사이트 없으면 사실상 멘션 불가 — 출처 검증 필수"),
        ("네이버 멘션 30%+", "4개 플랫폼 중 유일하게 네이버 평점/리뷰를 적극 인용"),
        ("가격 키워드 25.1%", "타 플랫폼 대비 2배 이상 — 가격 투명성이 멘션 트리거"),
        ("RESERVATION 6.0%", "예약 의도에서도 멘션 — 영업시간, 위치, 전화번호 중요"),
    ]
    
    for title, desc in patterns:
        draw_rounded_rect(c, 40, y-30, W-80, 28, r=6, fill_color=CARD_BG, stroke_color=HexColor('#ccfbf1'))
        c.setFont('NanumSquareB', 8.5)
        c.setFillColor(PERPLEXITY_COLOR)
        c.drawString(52, y-10, title)
        c.setFont('NanumSquareR', 7.5)
        c.setFillColor(MID_TEXT)
        c.drawString(52, y-23, desc)
        y -= 36
    
    y -= 5
    
    # Strategy
    c.setFont('NanumSquareEB', 12)
    c.setFillColor(PERPLEXITY_COLOR)
    c.drawString(40, y, "실전 공략 전략")
    y -= 22
    
    strategies = [
        ("1. 공식 웹사이트 필수 구축", "Perplexity는 출처 기반 검증 AI — 웹사이트가 없으면 멘션 자체가 불가능"),
        ("2. 네이버 플레이스 최적화", "평점 4.5 이상, 리뷰수, 영업정보 완벽 관리 — Perplexity가 직접 참조"),
        ("3. 가격/비용 정보 투명 공개", "시술 가격표, FAQ를 웹에 명확히 게시 — 가격 키워드가 멘션 트리거"),
        ("4. 구조화된 데이터(Schema)", "의료진 프로필, 진료시간, 위치정보를 구조화된 HTML로 작성"),
    ]
    
    for title, desc in strategies:
        draw_rounded_rect(c, 40, y-30, W-80, 28, r=6, fill_color=CARD_BG, stroke_color=HexColor('#ccfbf1'))
        c.setFont('NanumSquareB', 8.5)
        c.setFillColor(PERPLEXITY_COLOR)
        c.drawString(52, y-10, title)
        c.setFont('NanumSquareR', 7.5)
        c.setFillColor(MID_TEXT)
        c.drawString(52, y-23, desc)
        y -= 36

    y -= 10
    
    # Formula
    draw_rounded_rect(c, 40, y-38, W-80, 36, r=8, fill_color=HexColor('#134e5e'))
    c.setFont('NanumSquareEB', 10)
    c.setFillColor(white)
    c.drawCentredString(W/2, y-16, "Perplexity 공식")
    c.setFont('NanumSquareB', 9)
    c.setFillColor(HexColor('#99f6e4'))
    c.drawCentredString(W/2, y-30, "공식 웹사이트 + 네이버 평점 4.5+ + 가격 투명성 = 1위 단독추천")
    
    draw_footer(c, 4)


# ============ PAGE 5: Gemini ============
def page_gemini(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    draw_gradient_rect(c, 0, H-70, W, 70, HexColor('#4a1d96'), HexColor('#8e44ef'))
    c.setFont('NanumSquareEB', 20)
    c.setFillColor(white)
    c.drawString(40, H-48, "Gemini 공략법")
    c.setFont('NanumSquareR', 10)
    c.setFillColor(HexColor('#ddd6fe'))
    c.drawRightString(W-40, H-45, "키워드 다양성 + 지역 커버리지")
    
    y = H - 100
    
    cards = [
        ("멘션율", "35.4%", "전 플랫폼 최고!", GEMINI_COLOR),
        ("COMPARISON 멘션", "81.3%", "비교 질문 = Gemini", ACCENT_RED),
        ("포지션 분산", "33위까지", "가장 많이 나열", ACCENT_ORANGE),
        ("R2 추천", "최다", "복수 추천 압도적", ACCENT_BLUE),
    ]
    card_w = (W - 100) / 4
    for i, (label, val, sub, color) in enumerate(cards):
        draw_stat_card(c, 40 + i*(card_w+8), y-58, card_w, 55, label, val, sub, color)
    
    y -= 80
    
    # Key insight
    draw_rounded_rect(c, 35, y-70, W-70, 68, r=8, fill_color=HexColor('#f5f3ff'), stroke_color=GEMINI_COLOR, stroke_width=1)
    c.setFont('NanumSquareEB', 10)
    c.setFillColor(GEMINI_COLOR)
    c.drawString(50, y-18, "Gemini의 특성")
    c.setFont('NanumSquareR', 8.5)
    c.setFillColor(DARK_TEXT)
    c.drawString(50, y-34, "Gemini는 가장 관대하게 병원을 멘션(35.4%)하지만, R3 단독추천 비율은 최저입니다.")
    c.drawString(50, y-48, "한 응답에 수십 개 병원을 나열 — '일단 목록에 포함되는 것'이 핵심 전략입니다.")
    c.drawString(50, y-62, "비교(COMPARISON) 질문에서 81.3% 멘션 — 4개 플랫폼 중 비교 질문에 가장 강합니다.")
    
    y -= 88
    
    # Intent comparison - Gemini dominance
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "질문 의도별 멘션율 — Gemini의 압도적 우위")
    y -= 20
    
    intents = [
        ("COMPARISON (비교)", 81.3, ACCENT_PURPLE),
        ("INFORMATION (정보)", 53.2, ACCENT_BLUE),
        ("REVIEW (후기)", 19.8, ACCENT_ORANGE),
        ("RESERVATION (예약)", 2.3, ACCENT_TEAL),
        ("FEAR (공포/걱정)", 1.5, ACCENT_RED),
    ]
    for label, pct, color in intents:
        c.setFont('NanumSquareR', 8)
        c.setFillColor(DARK_TEXT)
        c.drawString(50, y, label)
        draw_progress_bar(c, 200, y-2, 250, 12, pct/100, color)
        c.setFont('NanumSquareB', 8)
        c.setFillColor(color)
        c.drawString(460, y, f"{pct}%")
        y -= 20
    
    y -= 15
    
    # Strategy
    c.setFont('NanumSquareEB', 12)
    c.setFillColor(GEMINI_COLOR)
    c.drawString(40, y, "실전 공략 전략")
    y -= 22
    
    strategies = [
        ("1. 진료과목 최대 다양화", "임플란트, 교정뿐 아니라 충치, 사랑니, 잇몸치료 등 일반 진료까지 콘텐츠 확보"),
        ("2. 시술별 상세 FAQ 제작", "시술 장단점·과정·회복기간 등 환자 궁금증 해소 콘텐츠가 81% 멘션율의 핵심"),
        ("3. 지역 키워드 다양화", "지역명 + 진료과목 조합 (예: '천안 임플란트', '서초 교정')으로 검색 커버리지 확대"),
        ("4. 전문의 자격 강조", "전문의 출현율 65.1%로 최고 — 전문의 자격과 학력을 명확히 표시"),
    ]
    
    for title, desc in strategies:
        draw_rounded_rect(c, 40, y-30, W-80, 28, r=6, fill_color=CARD_BG, stroke_color=HexColor('#ede9fe'))
        c.setFont('NanumSquareB', 8.5)
        c.setFillColor(GEMINI_COLOR)
        c.drawString(52, y-10, title)
        c.setFont('NanumSquareR', 7.5)
        c.setFillColor(MID_TEXT)
        c.drawString(52, y-23, desc)
        y -= 36
    
    y -= 10
    
    draw_rounded_rect(c, 40, y-38, W-80, 36, r=8, fill_color=HexColor('#4a1d96'))
    c.setFont('NanumSquareEB', 10)
    c.setFillColor(white)
    c.drawCentredString(W/2, y-16, "Gemini 공식")
    c.setFont('NanumSquareB', 9)
    c.setFillColor(HexColor('#ddd6fe'))
    c.drawCentredString(W/2, y-30, "전문의 자격 + 다양한 진료과목 + 지역 키워드 = 높은 멘션율 (목록 포함 전략)")
    
    draw_footer(c, 5)


# ============ PAGE 6: Claude ============
def page_claude(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    draw_gradient_rect(c, 0, H-70, W, 70, HexColor('#78350f'), HexColor('#d97706'))
    c.setFont('NanumSquareEB', 20)
    c.setFillColor(white)
    c.drawString(40, H-48, "Claude 공략법")
    c.setFont('NanumSquareR', 10)
    c.setFillColor(HexColor('#fef3c7'))
    c.drawRightString(W-40, H-45, "권위 + 웹 신뢰도")
    
    y = H - 100
    
    cards = [
        ("멘션율", "25.3%", "중상위 수준", CLAUDE_COLOR),
        ("웹 의존도", "66.9%", "전 플랫폼 최고", ACCENT_RED),
        ("네이버 의존", "66.1%", "역시 최고 수준", ACCENT_GREEN),
        ("REVIEW 멘션", "45.6%", "후기 질문 최강", ACCENT_BLUE),
    ]
    card_w = (W - 100) / 4
    for i, (label, val, sub, color) in enumerate(cards):
        draw_stat_card(c, 40 + i*(card_w+8), y-58, card_w, 55, label, val, sub, color)
    
    y -= 80
    
    draw_rounded_rect(c, 35, y-70, W-70, 68, r=8, fill_color=HexColor('#fffbeb'), stroke_color=CLAUDE_COLOR, stroke_width=1)
    c.setFont('NanumSquareEB', 10)
    c.setFillColor(CLAUDE_COLOR)
    c.drawString(50, y-18, "Claude의 특성")
    c.setFont('NanumSquareR', 8.5)
    c.setFillColor(DARK_TEXT)
    c.drawString(50, y-34, "Claude는 웹사이트 보유 병원 멘션 비율이 66.9%로 4개 플랫폼 중 최고입니다.")
    c.drawString(50, y-48, "'추천' 키워드 출현율 84.5%로 가장 높고, 전문의 권위를 가장 중시합니다.")
    c.drawString(50, y-62, "REVIEW(후기) 질문 멘션율 45.6%로 최고 — 환자 후기가 Claude 공략의 핵심입니다.")
    
    y -= 88
    
    # Web/Naver impact
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "Claude에서 웹사이트/네이버의 영향력")
    y -= 25
    
    comparisons = [
        ("웹사이트 보유", "66.9%", "웹사이트 미보유", "33.1%", CLAUDE_COLOR),
        ("네이버 보유", "66.1%", "네이버 미보유", "33.9%", ACCENT_ORANGE),
    ]
    
    for label1, val1, label2, val2, color in comparisons:
        # Left bar
        c.setFont('NanumSquareR', 8)
        c.setFillColor(DARK_TEXT)
        c.drawString(50, y, label1)
        draw_progress_bar(c, 150, y-2, 150, 14, float(val1.strip('%'))/100, color)
        c.setFont('NanumSquareB', 8)
        c.setFillColor(color)
        c.drawString(310, y, val1)
        
        # Right bar
        c.setFont('NanumSquareR', 8)
        c.setFillColor(MID_TEXT)
        c.drawString(345, y, label2)
        draw_progress_bar(c, 440, y-2, 80, 14, float(val2.strip('%'))/100, HexColor('#e2e8f0'))
        c.setFont('NanumSquareR', 8)
        c.setFillColor(LIGHT_TEXT)
        c.drawString(530, y, val2)
        y -= 24
    
    y -= 15
    
    # Strategy
    c.setFont('NanumSquareEB', 12)
    c.setFillColor(CLAUDE_COLOR)
    c.drawString(40, y, "실전 공략 전략")
    y -= 22
    
    strategies = [
        ("1. 웹사이트 + 네이버 동시 확보", "Claude 멘션의 67%가 웹+네이버 보유 병원에서 발생 — 둘 다 필수"),
        ("2. 전문의 자격/학력 상세 게시", "서울대 졸업, 전문의, 수련 경력 등 권위 키워드를 웹에 명확히 표시"),
        ("3. 환자 후기/리뷰 관리", "REVIEW 질문 멘션율 45.6%로 최고 — 구글/네이버 후기 적극 관리"),
        ("4. 첨단 기술 콘텐츠", "3D(28.9%), 디지털(35.9%), 수술(30.1%) 등 첨단 기술 키워드에 민감"),
    ]
    
    for title, desc in strategies:
        draw_rounded_rect(c, 40, y-30, W-80, 28, r=6, fill_color=CARD_BG, stroke_color=HexColor('#fef3c7'))
        c.setFont('NanumSquareB', 8.5)
        c.setFillColor(CLAUDE_COLOR)
        c.drawString(52, y-10, title)
        c.setFont('NanumSquareR', 7.5)
        c.setFillColor(MID_TEXT)
        c.drawString(52, y-23, desc)
        y -= 36
    
    y -= 10
    
    draw_rounded_rect(c, 40, y-38, W-80, 36, r=8, fill_color=HexColor('#78350f'))
    c.setFont('NanumSquareEB', 10)
    c.setFillColor(white)
    c.drawCentredString(W/2, y-16, "Claude 공식")
    c.setFont('NanumSquareB', 9)
    c.setFillColor(HexColor('#fef3c7'))
    c.drawCentredString(W/2, y-30, "전문의 권위 + 웹 & 네이버 존재감 + 기술 키워드 = 높은 멘션 + 추천")
    
    draw_footer(c, 6)


# ============ PAGE 7: TOP10 vs BOTTOM10 + Action Plan ============
def page_action_plan(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    draw_gradient_rect(c, 0, H-70, W, 70, HexColor('#1a1a2e'), HexColor('#312e81'))
    c.setFont('NanumSquareEB', 18)
    c.setFillColor(white)
    c.drawString(40, H-48, "TOP10 vs BOTTOM10 & 실전 액션플랜")
    
    y = H - 100
    
    # TOP10 vs BOTTOM10 comparison
    c.setFont('NanumSquareEB', 12)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "TOP10 vs BOTTOM10 병원 비교")
    y -= 10
    
    # Side-by-side cards
    half_w = (W - 90) / 2
    
    # TOP10 card
    draw_rounded_rect(c, 35, y-130, half_w, 128, r=8, fill_color=CARD_BG, stroke_color=ACCENT_GREEN, stroke_width=1.5)
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(ACCENT_GREEN)
    c.drawString(50, y-18, "TOP 10")
    
    top_stats = [
        ("평균 점수", "68.9점"),
        ("SOV", "51.1%"),
        ("평균 멘션수", "약 3배↑"),
        ("웹사이트 보유", "30%"),
        ("네이버 보유", "20%"),
        ("전 플랫폼", "고르게 멘션"),
    ]
    ty = y - 35
    for label, val in top_stats:
        c.setFont('NanumSquareR', 7.5)
        c.setFillColor(MID_TEXT)
        c.drawString(50, ty, label)
        c.setFont('NanumSquareB', 7.5)
        c.setFillColor(DARK_TEXT)
        c.drawRightString(35 + half_w - 15, ty, val)
        ty -= 16
    
    # BOTTOM10 card
    bx = 35 + half_w + 20
    draw_rounded_rect(c, bx, y-130, half_w, 128, r=8, fill_color=CARD_BG, stroke_color=ACCENT_RED, stroke_width=1.5)
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(ACCENT_RED)
    c.drawString(bx + 15, y-18, "BOTTOM 10")
    
    bottom_stats = [
        ("평균 점수", "6.4점"),
        ("SOV", "0%"),
        ("평균 멘션수", "거의 0"),
        ("웹사이트 보유", "10%"),
        ("네이버 보유", "0%"),
        ("전 플랫폼", "멘션 없음"),
    ]
    ty = y - 35
    for label, val in bottom_stats:
        c.setFont('NanumSquareR', 7.5)
        c.setFillColor(MID_TEXT)
        c.drawString(bx + 15, ty, label)
        c.setFont('NanumSquareB', 7.5)
        c.setFillColor(DARK_TEXT)
        c.drawRightString(bx + half_w - 15, ty, val)
        ty -= 16
    
    y -= 148
    
    # Key insight
    draw_rounded_rect(c, 35, y-35, W-70, 33, r=6, fill_color=HexColor('#fef2f2'), stroke_color=ACCENT_RED)
    c.setFont('NanumSquareEB', 9)
    c.setFillColor(ACCENT_RED)
    c.drawString(50, y-13, "결정적 차이:")
    c.setFont('NanumSquareR', 8.5)
    c.setFillColor(DARK_TEXT)
    c.drawString(130, y-13, "웹+네이버 둘 다 보유 시 멘션수 약 3배 차이 — 가시성의 결정적 요인!")
    c.setFont('NanumSquareB', 8.5)
    c.setFillColor(ACCENT_RED)
    c.drawString(130, y-27, "BOTTOM 10은 네이버 보유율 0% — AI에게 아예 인식되지 않음")
    
    y -= 55
    
    # Intent Strategy Table
    c.setFont('NanumSquareEB', 12)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "질문 의도별 최적 전략")
    y -= 22
    
    # Header
    h_cols = ["질문 의도", "최강 플랫폼", "멘션율", "공략 포인트"]
    h_widths = [110, 110, 85, 210]
    draw_rounded_rect(c, 35, y-6, W-70, 20, r=4, fill_color=PRIMARY)
    cx = 40
    for txt, w in zip(h_cols, h_widths):
        c.setFont('NanumSquareB', 7.5)
        c.setFillColor(white)
        c.drawString(cx + 4, y, txt)
        cx += w
    y -= 22
    
    intent_rows = [
        ["COMPARISON (비교)", "Gemini", "81.3%", "시술별 장단점·FAQ 콘텐츠 제작"],
        ["INFORMATION (정보)", "Gemini", "53.2%", "진료 정보 + 전문성 + 장비 강조"],
        ["REVIEW (후기)", "Claude", "45.6%", "환자 후기/리뷰 적극 관리"],
        ["RESERVATION (예약)", "Perplexity", "6.0%", "가격+접근성+영업시간 공개"],
        ["FEAR (공포/걱정)", "전체 <5%", "<5%", "AI가 아직 약한 영역 — 블로그 활용"],
    ]
    
    for i, row in enumerate(intent_rows):
        bg = HexColor('#f1f5f9') if i % 2 == 0 else CARD_BG
        c.setFillColor(bg)
        c.rect(35, y-6, W-70, 20, fill=1, stroke=0)
        cx = 40
        for j, (txt, w) in enumerate(zip(row, h_widths)):
            c.setFont('NanumSquareB' if j < 2 else 'NanumSquareR', 7.5)
            c.setFillColor(DARK_TEXT if j == 0 else MID_TEXT)
            c.drawString(cx + 4, y, txt)
            cx += w
        y -= 20
    
    y -= 20
    
    # Action plan
    c.setFont('NanumSquareEB', 12)
    c.setFillColor(ACCENT_BLUE)
    c.drawString(40, y, "즉시 실행 액션 플랜 (우선순위순)")
    y -= 22
    
    actions = [
        ("HIGH", "모든 고객 병원에 웹사이트 구축 권유", "멘션수 3배 차이의 결정적 요인", ACCENT_RED),
        ("HIGH", "네이버 플레이스 최적화", "Perplexity, Claude 공략 핵심 — 평점 4.5+, 리뷰 관리", ACCENT_RED),
        ("MED", "진료과목별 전문 콘텐츠 제작", "임플란트(+20%), 디지털(+15%) 키워드가 ChatGPT 멘션 트리거", ACCENT_ORANGE),
        ("MED", "시술별 FAQ·장단점 콘텐츠", "Gemini 81%, Claude 78% — 비교형 질문 대응이 AI 멘션의 핵심", ACCENT_ORANGE),
        ("LOW", "가격 투명성 확보", "Perplexity 전용 공략 — 유일하게 가격 정보 참조 (25%+)", ACCENT_BLUE),
        ("LOW", "전문의 자격/경력 웹 게시", "Claude(72.5%), Gemini(65%) — 권위 키워드가 멘션 핵심", ACCENT_BLUE),
    ]
    
    for priority, title, desc, color in actions:
        draw_rounded_rect(c, 40, y-32, W-80, 30, r=6, fill_color=CARD_BG, stroke_color=HexColor('#e2e8f0'))
        # Priority badge
        badge_w = 35
        draw_rounded_rect(c, 46, y-9, badge_w, 14, r=7, fill_color=color)
        c.setFont('NanumSquareB', 6.5)
        c.setFillColor(white)
        c.drawCentredString(46 + badge_w/2, y-5, priority)
        
        c.setFont('NanumSquareB', 8)
        c.setFillColor(DARK_TEXT)
        c.drawString(88, y-8, title)
        c.setFont('NanumSquareR', 7)
        c.setFillColor(MID_TEXT)
        c.drawString(88, y-22, desc)
        y -= 37
    
    draw_footer(c, 7)


# ============ PAGE 8: About Patient Signal ============
def page_about(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    draw_gradient_rect(c, 0, H-70, W, 70, HexColor('#1a1a2e'), HexColor('#4361ee'))
    c.setFont('NanumSquareEB', 18)
    c.setFillColor(white)
    c.drawString(40, H-48, "About Patient Signal")
    c.setFont('NanumSquareR', 9)
    c.setFillColor(HexColor('#93c5fd'))
    c.drawRightString(W-40, H-45, "AI 가시성 모니터링 & 최적화 플랫폼")
    
    y = H - 110
    
    # Main description
    draw_rounded_rect(c, 35, y-85, W-70, 83, r=10, fill_color=CARD_BG, stroke_color=ACCENT_BLUE, stroke_width=1.5)
    c.setFont('NanumSquareEB', 13)
    c.setFillColor(ACCENT_BLUE)
    c.drawCentredString(W/2, y-18, "Patient Signal")
    c.setFont('NanumSquareR', 9)
    c.setFillColor(DARK_TEXT)
    c.drawCentredString(W/2, y-38, "ChatGPT, Perplexity, Gemini, Claude에서 우리 병원이 어떻게 추천되는지")
    c.drawCentredString(W/2, y-54, "실시간으로 모니터링하고, 데이터 기반으로 AI 가시성을 최적화하는 플랫폼입니다.")
    c.setFont('NanumSquareB', 9)
    c.setFillColor(ACCENT_BLUE)
    c.drawCentredString(W/2, y-72, "https://patientsignal.co.kr")
    
    y -= 108
    
    # Features
    c.setFont('NanumSquareEB', 12)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "핵심 기능")
    y -= 18
    
    features = [
        ("AI 가시성 점수 (ABHS)", "4개 AI 플랫폼에서의 병원 추천 현황을 0~100점으로 수치화", ACCENT_BLUE),
        ("플랫폼별 상세 분석", "ChatGPT/Perplexity/Gemini/Claude 각각의 멘션율, 포지션, 감성 분석", ACCENT_PURPLE),
        ("경쟁사 모니터링", "지역 내 경쟁 병원의 AI 가시성을 실시간 추적 및 비교", ACCENT_TEAL),
        ("일일 점수 트렌드", "매일 자동 크롤링으로 AI 가시성 변동 추이를 시계열 분석", ACCENT_GREEN),
        ("콘텐츠 갭 분석", "AI가 추천하지 않는 영역을 발견하고 개선 방향 제시", ACCENT_ORANGE),
        ("주간 리포트", "매주 월요일 AI 성과 리포트를 이메일로 자동 발송", ACCENT_PINK),
    ]
    
    for title, desc, color in features:
        draw_rounded_rect(c, 40, y-30, W-80, 28, r=6, fill_color=CARD_BG, stroke_color=HexColor('#e2e8f0'))
        # Color dot
        c.setFillColor(color)
        c.circle(52, y-15, 4, fill=1, stroke=0)
        c.setFont('NanumSquareB', 8.5)
        c.setFillColor(DARK_TEXT)
        c.drawString(62, y-10, title)
        c.setFont('NanumSquareR', 7.5)
        c.setFillColor(MID_TEXT)
        c.drawString(62, y-23, desc)
        y -= 34
    
    y -= 15
    
    # Data advantage box
    draw_rounded_rect(c, 35, y-75, W-70, 73, r=8, fill_color=HexColor('#eff6ff'), stroke_color=ACCENT_BLUE)
    c.setFont('NanumSquareEB', 10)
    c.setFillColor(ACCENT_BLUE)
    c.drawString(50, y-16, "이 데이터는 세계 어디에도 없습니다")
    c.setFont('NanumSquareR', 8)
    c.setFillColor(DARK_TEXT)
    c.drawString(50, y-32, "4개 AI 플랫폼 동시 모니터링 + 실시간 점수화 + 실증 데이터 기반 전략")
    c.drawString(50, y-46, "Google/OpenAI는 자기 플랫폼만, SEO 업체는 AI 분석 능력 없음, 마케팅 대행사는 측정 불가")
    c.setFont('NanumSquareB', 8)
    c.setFillColor(ACCENT_BLUE)
    c.drawString(50, y-62, "Patient Signal만이 4개 AI를 동시에 추적하고, 실증 데이터로 전략을 제시합니다.")
    
    y -= 90
    
    # Contact
    draw_rounded_rect(c, 35, y-55, W-70, 53, r=8, fill_color=PRIMARY)
    c.setFont('NanumSquareEB', 12)
    c.setFillColor(white)
    c.drawCentredString(W/2, y-18, "Patient Signal 시작하기")
    c.setFont('NanumSquareB', 10)
    c.setFillColor(ACCENT_TEAL)
    c.drawCentredString(W/2, y-36, "https://patientsignal.co.kr")
    c.setFont('NanumSquareR', 8)
    c.setFillColor(HexColor('#94a3b8'))
    c.drawCentredString(W/2, y-50, "AI 시대, 환자가 AI에게 물어보는 시대 — 우리 병원은 준비되어 있나요?")
    
    draw_footer(c, 8)


# ============ GENERATE PDF ============
def generate():
    output_path = "/home/user/webapp/ai_platform_strategy_report.pdf"
    c = canvas.Canvas(output_path, pagesize=A4)
    c.setTitle("AI 플랫폼별 공략 전략 리포트 - Patient Signal")
    c.setAuthor("Patient Signal")
    c.setSubject("대규모 AI 응답 데이터 기반 실전 가이드")
    
    # Page 1: Cover
    page_cover(c)
    c.showPage()
    
    # Page 2: Executive Summary
    page_executive_summary(c)
    c.showPage()
    
    # Page 3: ChatGPT
    page_chatgpt(c)
    c.showPage()
    
    # Page 4: Perplexity
    page_perplexity(c)
    c.showPage()
    
    # Page 5: Gemini
    page_gemini(c)
    c.showPage()
    
    # Page 6: Claude
    page_claude(c)
    c.showPage()
    
    # Page 7: Action Plan
    page_action_plan(c)
    c.showPage()
    
    # Page 8: About
    page_about(c)
    c.showPage()
    
    c.save()
    print(f"PDF generated: {output_path}")
    print(f"File size: {os.path.getsize(output_path) / 1024:.1f} KB")

if __name__ == "__main__":
    generate()
