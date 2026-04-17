#!/usr/bin/env python3
"""
AEO 무료 가이드 PDF (7페이지)
인스타 DM 배포용 — Patient Signal 언급 없음, 내부 데이터 비노출
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

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

W, H = A4  # 595 x 842

# ============ HELPER FUNCTIONS ============
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

def draw_footer(c, page_num, total=7):
    c.saveState()
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(40, 35, W-40, 35)
    c.setFont('NanumSquareR', 7)
    c.setFillColor(LIGHT_TEXT)
    c.drawString(40, 22, "AEO 완전 가이드  |  AI 시대 병원 마케팅의 새로운 기준")
    c.setFont('NanumSquareB', 7)
    c.setFillColor(ACCENT_BLUE)
    c.drawCentredString(W/2, 22, "Patient Funnel")
    c.setFont('NanumSquareR', 7)
    c.setFillColor(LIGHT_TEXT)
    c.drawRightString(W-40, 22, f"{page_num} / {total}")
    c.restoreState()

def draw_stat_card(c, x, y, w, h, label, value, sub="", color=ACCENT_BLUE):
    draw_rounded_rect(c, x, y, w, h, r=6, fill_color=CARD_BG, stroke_color=BORDER)
    # Top accent bar
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

def draw_bullet(c, x, y, text, font='NanumSquareR', size=8, color=MID_TEXT, bullet_color=ACCENT_BLUE):
    c.setFillColor(bullet_color)
    c.circle(x + 3, y + 3, 2.5, fill=1, stroke=0)
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawString(x + 12, y, text)


# ============ PAGE 1: COVER ============
def page_cover(c):
    draw_gradient_rect(c, 0, 0, W, H, HexColor('#020617'), HexColor('#0f172a'))
    
    # Decorative circles
    c.saveState()
    c.setFillColor(ACCENT_INDIGO)
    c.setFillAlpha(0.07)
    c.circle(W*0.82, H*0.78, 220, fill=1, stroke=0)
    c.setFillColor(ACCENT_BLUE)
    c.setFillAlpha(0.05)
    c.circle(W*0.12, H*0.3, 180, fill=1, stroke=0)
    c.setFillColor(ACCENT_TEAL)
    c.setFillAlpha(0.04)
    c.circle(W*0.5, H*0.05, 160, fill=1, stroke=0)
    c.restoreState()
    
    # Top tag
    draw_rounded_rect(c, W/2 - 130, H - 120, 260, 28, r=14, 
                       fill_color=HexColor('#1e1b4b'), stroke_color=ACCENT_INDIGO, stroke_width=0.8)
    c.setFont('NanumSquareB', 9)
    c.setFillColor(ACCENT_BLUE)
    c.drawCentredString(W/2, H - 112, "SEO만으로는 부족한 시대가 왔습니다")
    
    # Title
    c.setFont('NanumSquareEB', 42)
    c.setFillColor(white)
    c.drawCentredString(W/2, H - 195, "AEO")
    c.drawCentredString(W/2, H - 250, "완전 가이드")
    
    # Subtitle accent
    c.setFont('NanumSquareEB', 16)
    c.setFillColor(ACCENT_CYAN)
    c.drawCentredString(W/2, H - 295, "AI에게 선택받는 병원이 되는 법")
    
    # Divider
    c.setStrokeColor(ACCENT_INDIGO)
    c.setLineWidth(2)
    c.line(W/2 - 50, H - 320, W/2 + 50, H - 320)
    
    # Description
    c.setFont('NanumSquareR', 11)
    c.setFillColor(HexColor('#94a3b8'))
    c.drawCentredString(W/2, H - 350, "ChatGPT · Perplexity · Gemini · Claude")
    c.drawCentredString(W/2, H - 370, "4개 AI 플랫폼의 병원 추천 로직을 해부합니다")
    
    # Key topics box
    box_y = H - 520
    draw_rounded_rect(c, 60, box_y, W-120, 120, r=12, 
                       fill_color=HexColor('#1e1b4b'), stroke_color=ACCENT_INDIGO, stroke_width=0.8)
    
    c.setFont('NanumSquareEB', 10)
    c.setFillColor(ACCENT_BLUE)
    c.drawCentredString(W/2, box_y + 100, "이 가이드에서 다루는 내용")
    
    topics = [
        "AEO란 무엇인가? — SEO와 무엇이 다른가",
        "4개 AI 플랫폼은 각각 어떻게 병원을 추천하는가",
        "AI에게 '보이지 않는 병원'이 되는 3가지 이유",
        "지금 당장 실행할 수 있는 AEO 액션 플랜",
    ]
    ty = box_y + 78
    for topic in topics:
        c.setFillColor(ACCENT_CYAN)
        c.circle(85, ty + 3, 3, fill=1, stroke=0)
        c.setFont('NanumSquareR', 9)
        c.setFillColor(HexColor('#cbd5e1'))
        c.drawString(96, ty, topic)
        ty -= 18
    
    # Bottom brand
    c.setFont('NanumSquareEB', 12)
    c.setFillColor(white)
    c.drawCentredString(W/2, 120, "Patient Funnel")
    
    c.setFont('NanumSquareRoundR', 9)
    c.setFillColor(HexColor('#64748b'))
    c.drawCentredString(W/2, 100, "환자 경험 설계 전문 — 6,000+ 원장님이 선택한 병원 경영 시스템")

    c.setFont('NanumSquareR', 8)
    c.setFillColor(HexColor('#475569'))
    c.drawCentredString(W/2, 78, "이 가이드는 인스타그램 팔로워를 위한 무료 배포본입니다")


# ============ PAGE 2: AEO란 무엇인가 ============
def page_what_is_aeo(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    # Header
    draw_gradient_rect(c, 0, H-75, W, 75, HexColor('#1e1b4b'), HexColor('#4338ca'))
    c.setFont('NanumSquareEB', 20)
    c.setFillColor(white)
    c.drawString(40, H-50, "AEO란 무엇인가?")
    c.setFont('NanumSquareR', 10)
    c.setFillColor(HexColor('#a5b4fc'))
    c.drawRightString(W-40, H-47, "AI Engine Optimization")
    
    y = H - 105
    
    # Definition box
    draw_rounded_rect(c, 35, y-70, W-70, 68, r=10, fill_color=PRIMARY)
    c.setFont('NanumSquareEB', 13)
    c.setFillColor(ACCENT_CYAN)
    c.drawCentredString(W/2, y-18, "AEO = AI Engine Optimization")
    c.setFont('NanumSquareR', 9.5)
    c.setFillColor(HexColor('#cbd5e1'))
    c.drawCentredString(W/2, y-38, "AI 플랫폼(ChatGPT, Gemini, Perplexity, Claude 등)이")
    c.drawCentredString(W/2, y-54, "우리 병원을 '추천'하도록 최적화하는 전략")
    
    y -= 90
    
    # SEO vs AEO comparison
    c.setFont('NanumSquareEB', 12)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "SEO vs AEO — 무엇이 다른가?")
    y -= 20
    
    half_w = (W - 95) / 2
    
    # SEO box
    draw_rounded_rect(c, 35, y-175, half_w, 173, r=10, fill_color=CARD_BG, stroke_color=HexColor('#e2e8f0'), stroke_width=1)
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(LIGHT_TEXT)
    c.drawString(50, y-16, "SEO (기존)")
    c.setFont('NanumSquareR', 8)
    c.setFillColor(MID_TEXT)
    
    seo_items = [
        "Google/네이버 검색 결과 순위 최적화",
        "키워드 중심 콘텐츠",
        "백링크, 메타태그 최적화",
        "검색 결과 '목록'에 노출",
        "사용자가 직접 클릭해야 유입",
        "경쟁: 10개 파란 링크 중 1개",
    ]
    sy = y - 36
    for item in seo_items:
        c.setFillColor(LIGHT_TEXT)
        c.circle(52, sy+3, 2, fill=1, stroke=0)
        c.setFont('NanumSquareR', 7.5)
        c.setFillColor(MID_TEXT)
        c.drawString(60, sy, item)
        sy -= 17
    
    # OLD label
    draw_rounded_rect(c, 35 + half_w - 50, y - 170, 42, 16, r=8, fill_color=LIGHT_TEXT)
    c.setFont('NanumSquareB', 7)
    c.setFillColor(white)
    c.drawCentredString(35 + half_w - 29, y - 166, "기존 방식")
    
    # AEO box
    aeo_x = 35 + half_w + 25
    draw_rounded_rect(c, aeo_x, y-175, half_w, 173, r=10, fill_color=CARD_BG, stroke_color=ACCENT_BLUE, stroke_width=1.5)
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(ACCENT_BLUE)
    c.drawString(aeo_x + 15, y-16, "AEO (새로운 기준)")
    
    aeo_items = [
        "AI 플랫폼의 '답변'에 추천으로 노출",
        "맥락 + 권위 + 신뢰 중심",
        "구조화된 정보, 출처 신뢰도",
        "AI가 직접 '추천'으로 답변",
        "추천 자체가 강력한 전환 동력",
        "경쟁: AI가 고른 1~3곳에 진입",
    ]
    sy = y - 36
    for item in aeo_items:
        c.setFillColor(ACCENT_BLUE)
        c.circle(aeo_x + 17, sy+3, 2, fill=1, stroke=0)
        c.setFont('NanumSquareR', 7.5)
        c.setFillColor(DARK_TEXT)
        c.drawString(aeo_x + 25, sy, item)
        sy -= 17
    
    # NEW label
    draw_rounded_rect(c, aeo_x + half_w - 50, y - 170, 42, 16, r=8, fill_color=ACCENT_BLUE)
    c.setFont('NanumSquareB', 7)
    c.setFillColor(white)
    c.drawCentredString(aeo_x + half_w - 29, y - 166, "필수 전략")
    
    # Arrow between
    c.setFont('NanumSquareEB', 18)
    c.setFillColor(ACCENT_ORANGE)
    c.drawCentredString(W/2, y - 90, "→")
    
    y -= 195
    
    # Why AEO matters
    c.setFont('NanumSquareEB', 12)
    c.setFillColor(DARK_TEXT)
    c.drawString(40, y, "왜 지금 AEO인가?")
    y -= 18
    
    reasons = [
        ("환자 행동의 변화", "환자들이 Google 대신 ChatGPT에게 '강남 임플란트 잘하는 곳' 을 물어보기 시작했습니다"),
        ("AI 추천 = 강력한 신뢰", "검색 결과 10개 중 1개 vs AI가 직접 추천한 1~3곳 — 전환율의 차이는 압도적입니다"),
        ("선점 효과", "아직 대부분의 병원이 AEO를 모릅니다. 지금 시작하면 경쟁 없이 AI 추천 상위권을 선점할 수 있습니다"),
        ("4개 플랫폼, 4개 전략", "ChatGPT, Perplexity, Gemini, Claude — 각각 완전히 다른 로직으로 병원을 추천합니다"),
    ]
    
    for title, desc in reasons:
        draw_rounded_rect(c, 35, y-36, W-70, 34, r=6, fill_color=CARD_BG, stroke_color=BORDER)
        c.setFont('NanumSquareEB', 8.5)
        c.setFillColor(ACCENT_INDIGO)
        c.drawString(50, y-10, title)
        c.setFont('NanumSquareR', 7.5)
        c.setFillColor(MID_TEXT)
        c.drawString(50, y-25, desc)
        y -= 40
    
    # Bottom emphasis
    y -= 5
    draw_rounded_rect(c, 35, y-35, W-70, 33, r=8, fill_color=HexColor('#eff6ff'), stroke_color=ACCENT_BLUE)
    c.setFont('NanumSquareEB', 9.5)
    c.setFillColor(ACCENT_BLUE)
    c.drawCentredString(W/2, y-12, "SEO는 '검색에 노출되는 것', AEO는 'AI에게 추천받는 것'")
    c.setFont('NanumSquareR', 8)
    c.setFillColor(MID_TEXT)
    c.drawCentredString(W/2, y-27, "이 둘은 완전히 다른 게임이며, 둘 다 해야 합니다")
    
    draw_footer(c, 2)


# ============ PAGE 3: 4개 AI 플랫폼 특성 ============
def page_four_platforms(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    draw_gradient_rect(c, 0, H-75, W, 75, HexColor('#064e3b'), HexColor('#059669'))
    c.setFont('NanumSquareEB', 20)
    c.setFillColor(white)
    c.drawString(40, H-50, "4개 AI, 완전히 다릅니다")
    c.setFont('NanumSquareR', 10)
    c.setFillColor(HexColor('#a7f3d0'))
    c.drawRightString(W-40, H-47, "플랫폼별 추천 로직 해부")
    
    y = H - 100
    
    c.setFont('NanumSquareR', 8.5)
    c.setFillColor(MID_TEXT)
    c.drawString(40, y, "같은 질문을 해도 AI마다 전혀 다른 병원을 추천합니다. 각 AI의 추천 로직을 이해해야 전략을 세울 수 있습니다.")
    y -= 22
    
    # ChatGPT Section
    platforms = [
        {
            "name": "ChatGPT",
            "color": CHATGPT_COLOR,
            "bg": HexColor('#ecfdf5'),
            "subtitle": "브랜드 스토리텔러",
            "personality": "가장 길고 상세한 답변을 생성하며, 한번 추천하면 매우 긍정적으로 설명합니다",
            "what_matters": [
                "전문의 자격, 학력, 수련 경력 등 '권위' 키워드",
                "디지털 가이드, 3D CT 등 첨단 기술 키워드",
                "시술별 상세 경험과 브랜드 스토리",
            ],
            "key_insight": "멘션하면 높은 확률로 1위 추천 + 가장 긍정적 표현 → '단독추천'에 강함",
        },
        {
            "name": "Perplexity",
            "color": PERPLEXITY_COLOR,
            "bg": HexColor('#f0fdfa'),
            "subtitle": "출처 검증 심판관",
            "personality": "출처(URL)를 인용하며 추천하는 유일한 AI. 추천 빈도는 낮지만 한번 하면 거의 1위로 추천합니다",
            "what_matters": [
                "공식 웹사이트 존재 여부 (출처 인용이 핵심)",
                "네이버 플레이스 평점 (유일하게 네이버를 참조하는 AI)",
                "가격 투명성 — 비용 정보를 타 플랫폼 대비 2배 이상 중시",
            ],
            "key_insight": "멘션율은 가장 낮지만, 멘션 시 1위 추천율은 압도적 최고 → '한방'에 강함",
        },
        {
            "name": "Gemini",
            "color": GEMINI_COLOR,
            "bg": HexColor('#f5f3ff'),
            "subtitle": "관대한 큐레이터",
            "personality": "가장 많은 병원을 언급하지만, '1위 추천'은 가장 적습니다. 넓게 나열하는 스타일",
            "what_matters": [
                "다양한 시술 키워드 커버리지 (여러 진료과목)",
                "지역명 + 시술명 조합 (비교 질문 대응)",
                "전문의 자격 — 전문의 관련 키워드에 높은 반응",
            ],
            "key_insight": "가장 자주 언급하지만 '추천'보다 '나열' — 목록 진입은 쉽지만 단독추천은 어려움",
        },
        {
            "name": "Claude",
            "color": CLAUDE_COLOR,
            "bg": HexColor('#fffbeb'),
            "subtitle": "권위 중시 분석가",
            "personality": "웹사이트와 온라인 리뷰를 가장 많이 참조. 신뢰할 수 있는 정보원에서 데이터를 가져옵니다",
            "what_matters": [
                "공식 웹사이트 보유 여부 (의존도가 전 AI 중 최고)",
                "환자 후기/리뷰 — 후기 관련 질문에 가장 강하게 반응",
                "전문의 권위 + 네이버/구글 존재감",
            ],
            "key_insight": "후기/리뷰 질문에서 압도적 1위 → 환자 후기 관리가 Claude 공략의 핵심",
        },
    ]
    
    for p in platforms:
        card_h = 130
        draw_rounded_rect(c, 35, y - card_h, W-70, card_h, r=8, fill_color=CARD_BG, stroke_color=p["color"], stroke_width=1.2)
        
        # Color accent bar on top
        c.saveState()
        clip_path = c.beginPath()
        clip_path.roundRect(35, y - card_h, W-70, card_h, 8)
        c.clipPath(clip_path, stroke=0)
        c.setFillColor(p["color"])
        c.rect(35, y - 3, W-70, 3, fill=1, stroke=0)
        c.restoreState()
        
        # Platform name and subtitle
        draw_rounded_rect(c, 48, y - 22, len(p["name"]) * 10 + 18, 18, r=9, fill_color=p["color"])
        c.setFont('NanumSquareEB', 8.5)
        c.setFillColor(white)
        c.drawString(56, y - 18, p["name"])
        
        c.setFont('NanumSquareB', 8.5)
        c.setFillColor(p["color"])
        c.drawString(56 + len(p["name"]) * 10 + 24, y - 18, p["subtitle"])
        
        # Personality
        c.setFont('NanumSquareR', 7.5)
        c.setFillColor(MID_TEXT)
        c.drawString(48, y - 38, p["personality"])
        
        # What matters
        c.setFont('NanumSquareB', 7.5)
        c.setFillColor(DARK_TEXT)
        c.drawString(48, y - 55, "AI가 중시하는 것:")
        
        my = y - 70
        for item in p["what_matters"]:
            c.setFillColor(p["color"])
            c.circle(55, my + 3, 2, fill=1, stroke=0)
            c.setFont('NanumSquareR', 7)
            c.setFillColor(MID_TEXT)
            c.drawString(63, my, item)
            my -= 14
        
        # Key insight
        c.setFont('NanumSquareEB', 7)
        c.setFillColor(p["color"])
        c.drawString(48, y - card_h + 10, "▶ " + p["key_insight"])
        
        y -= card_h + 8
    
    draw_footer(c, 3)


# ============ PAGE 4: AI에게 보이지 않는 병원이 되는 이유 ============
def page_invisible_hospital(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    draw_gradient_rect(c, 0, H-75, W, 75, HexColor('#7f1d1d'), HexColor('#dc2626'))
    c.setFont('NanumSquareEB', 20)
    c.setFillColor(white)
    c.drawString(40, H-50, "AI에게 '없는 병원'이 되는 이유")
    c.setFont('NanumSquareR', 10)
    c.setFillColor(HexColor('#fecaca'))
    c.drawRightString(W-40, H-47, "대부분의 병원이 해당됩니다")
    
    y = H - 100
    
    # Intro
    c.setFont('NanumSquareR', 9)
    c.setFillColor(MID_TEXT)
    c.drawString(40, y, "AI에게 추천받지 못하는 병원들에는 명확한 공통점이 있습니다.")
    c.drawString(40, y-16, "아래 3가지 중 하나라도 해당되면, AI 추천 영역에서 사실상 '보이지 않는 병원'입니다.")
    y -= 45
    
    # Reason 1
    draw_rounded_rect(c, 35, y-175, W-70, 173, r=10, fill_color=CARD_BG, stroke_color=ACCENT_RED, stroke_width=1.5)
    
    draw_rounded_rect(c, 50, y-20, 120, 22, r=11, fill_color=ACCENT_RED)
    c.setFont('NanumSquareEB', 10)
    c.setFillColor(white)
    c.drawCentredString(110, y-14, "이유 #1")
    
    c.setFont('NanumSquareEB', 14)
    c.setFillColor(DARK_TEXT)
    c.drawString(180, y-16, "공식 웹사이트가 없다")
    
    c.setFont('NanumSquareR', 8.5)
    c.setFillColor(MID_TEXT)
    texts = [
        "AI는 '출처'를 기반으로 병원을 추천합니다.",
        "웹사이트가 없으면 AI가 참조할 수 있는 공식 정보 자체가 없습니다.",
        "",
        "특히 Perplexity는 URL을 직접 인용하며 추천하는 AI입니다.",
        "웹사이트가 없으면 Perplexity에서 아예 멘션될 수 없습니다.",
        "",
        "Claude 역시 웹사이트 보유 병원을 가장 높은 비율로 멘션합니다.",
        "웹사이트는 AI 가시성의 '절대 기본기'입니다.",
    ]
    ty = y - 42
    for t in texts:
        if t:
            c.drawString(50, ty, t)
        ty -= 14
    
    # Impact badge
    draw_rounded_rect(c, W - 190, y - 168, 138, 22, r=8, fill_color=HexColor('#fef2f2'))
    c.setFont('NanumSquareEB', 8)
    c.setFillColor(ACCENT_RED)
    c.drawCentredString(W - 121, y - 162, "영향도: 전 플랫폼 치명적")
    
    y -= 195
    
    # Reason 2
    draw_rounded_rect(c, 35, y-130, W-70, 128, r=10, fill_color=CARD_BG, stroke_color=ACCENT_ORANGE, stroke_width=1.5)
    
    draw_rounded_rect(c, 50, y-20, 120, 22, r=11, fill_color=ACCENT_ORANGE)
    c.setFont('NanumSquareEB', 10)
    c.setFillColor(white)
    c.drawCentredString(110, y-14, "이유 #2")
    
    c.setFont('NanumSquareEB', 14)
    c.setFillColor(DARK_TEXT)
    c.drawString(180, y-16, "네이버 플레이스가 없거나 부실하다")
    
    c.setFont('NanumSquareR', 8.5)
    c.setFillColor(MID_TEXT)
    texts2 = [
        "Perplexity는 4개 AI 중 유일하게 네이버 평점과 리뷰를 적극 인용합니다.",
        "Claude도 네이버 존재 여부를 멘션에 반영합니다.",
        "",
        "AI 추천 하위권 병원의 공통점: 네이버 플레이스 미등록 또는 방치.",
        "평점, 리뷰, 영업시간, 사진 — 모두 AI의 '판단 재료'입니다.",
    ]
    ty = y - 42
    for t in texts2:
        if t:
            c.drawString(50, ty, t)
        ty -= 14
    
    draw_rounded_rect(c, W - 210, y - 123, 158, 22, r=8, fill_color=HexColor('#fffbeb'))
    c.setFont('NanumSquareEB', 8)
    c.setFillColor(ACCENT_ORANGE)
    c.drawCentredString(W - 131, y - 117, "영향도: Perplexity·Claude 핵심")
    
    y -= 150
    
    # Reason 3
    draw_rounded_rect(c, 35, y-130, W-70, 128, r=10, fill_color=CARD_BG, stroke_color=ACCENT_PURPLE, stroke_width=1.5)
    
    draw_rounded_rect(c, 50, y-20, 120, 22, r=11, fill_color=ACCENT_PURPLE)
    c.setFont('NanumSquareEB', 10)
    c.setFillColor(white)
    c.drawCentredString(110, y-14, "이유 #3")
    
    c.setFont('NanumSquareEB', 14)
    c.setFillColor(DARK_TEXT)
    c.drawString(180, y-16, "전문의 정보가 온라인에 없다")
    
    c.setFont('NanumSquareR', 8.5)
    c.setFillColor(MID_TEXT)
    texts3 = [
        "ChatGPT와 Claude는 '전문의 자격'에 매우 민감하게 반응합니다.",
        "전문의 자격, 졸업 대학, 수련 경력, 학회 활동 등이 웹에 없으면",
        "AI가 추천할 '근거'가 사라집니다.",
        "",
        "Gemini 역시 전문의 관련 키워드 출현율이 높습니다.",
        "온라인에 전문의 프로필이 상세할수록 AI 멘션 확률이 올라갑니다.",
    ]
    ty = y - 42
    for t in texts3:
        if t:
            c.drawString(50, ty, t)
        ty -= 14
    
    draw_rounded_rect(c, W - 210, y - 123, 158, 22, r=8, fill_color=HexColor('#f5f3ff'))
    c.setFont('NanumSquareEB', 8)
    c.setFillColor(ACCENT_PURPLE)
    c.drawCentredString(W - 131, y - 117, "영향도: ChatGPT·Claude·Gemini")
    
    y -= 148
    
    # Bottom check
    draw_rounded_rect(c, 35, y-40, W-70, 38, r=8, fill_color=HexColor('#fef2f2'), stroke_color=ACCENT_RED)
    c.setFont('NanumSquareEB', 10)
    c.setFillColor(ACCENT_RED)
    c.drawCentredString(W/2, y-15, "체크리스트: 웹사이트 ✓ + 네이버 ✓ + 전문의 프로필 ✓")
    c.setFont('NanumSquareR', 8)
    c.setFillColor(MID_TEXT)
    c.drawCentredString(W/2, y-30, "이 3가지만 갖춰도 AI 추천 상위권 진입의 기본 조건을 충족합니다")
    
    draw_footer(c, 4)


# ============ PAGE 5: 환자가 AI에게 묻는 5가지 ============
def page_patient_questions(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    draw_gradient_rect(c, 0, H-75, W, 75, HexColor('#312e81'), HexColor('#6366f1'))
    c.setFont('NanumSquareEB', 20)
    c.setFillColor(white)
    c.drawString(40, H-50, "환자가 AI에게 묻는 5가지")
    c.setFont('NanumSquareR', 10)
    c.setFillColor(HexColor('#c7d2fe'))
    c.drawRightString(W-40, H-47, "질문 유형별 AI 추천 패턴")
    
    y = H - 100
    
    c.setFont('NanumSquareR', 9)
    c.setFillColor(MID_TEXT)
    c.drawString(40, y, "환자들이 AI에게 하는 질문은 크게 5가지 유형으로 나뉩니다.")
    c.drawString(40, y - 16, "각 유형마다 가장 강한 AI가 다르기 때문에, 유형별 전략이 필요합니다.")
    y -= 42
    
    intents = [
        {
            "name": "COMPARISON (비교 질문)",
            "color": ACCENT_PURPLE,
            "example": '"강남 임플란트 잘하는 곳 추천해줘"  "교정 잘하는 치과 어디야?"',
            "strong_ai": "Gemini와 Claude가 가장 활발하게 추천",
            "strategy": "시술별 상세 정보 + 지역 키워드 조합으로 비교 대상 목록에 진입",
            "note": "환자가 AI에게 가장 많이 하는 질문 유형 — 가장 중요한 전장터",
        },
        {
            "name": "INFORMATION (정보 탐색)",
            "color": ACCENT_BLUE,
            "example": '"임플란트 과정이 어떻게 돼?"  "교정 기간 얼마나 걸려?"',
            "strong_ai": "Gemini와 ChatGPT가 주요 게이트키퍼",
            "strategy": "시술 FAQ, 과정 설명, 회복 정보 등 정보성 콘텐츠를 웹에 상세히",
            "note": "정보를 잘 제공하는 병원을 AI가 '전문가'로 인식하여 추천 확률 상승",
        },
        {
            "name": "REVIEW (후기 확인)",
            "color": ACCENT_ORANGE,
            "example": '"OO치과 어때요?"  "임플란트 후기 알려줘"',
            "strong_ai": "Claude가 후기 질문에 압도적으로 강함",
            "strategy": "구글/네이버 후기 관리, 환자 만족도 콘텐츠 → Claude 멘션 트리거",
            "note": "후기가 좋은 병원을 Claude는 적극적으로 추천함",
        },
        {
            "name": "RESERVATION (예약/정보)",
            "color": ACCENT_TEAL,
            "example": '"영업시간 알려줘"  "가격 얼마야?"  "예약하려면?"',
            "strong_ai": "Perplexity가 예약/가격 정보에 가장 민감",
            "strategy": "네이버/구글에 영업시간, 가격, 연락처 정확히 등록 + 온라인 예약",
            "note": "전체적으로 AI 멘션이 낮은 영역 — 정보 정확성이 차별화 포인트",
        },
        {
            "name": "FEAR (공포/걱정)",
            "color": ACCENT_RED,
            "example": '"임플란트 아프나요?"  "실패하면 어떡해?"  "부작용 있어?"',
            "strong_ai": "전 플랫폼 모두 약한 영역 — AI의 사각지대!",
            "strategy": "블로그/영상으로 공포 해소 콘텐츠 선점 → 블루오션",
            "note": "AI가 아직 잘 못 다루는 영역 → 지금 선점하면 독점적 위치 확보 가능",
        },
    ]
    
    for intent in intents:
        card_h = 105
        draw_rounded_rect(c, 35, y - card_h, W-70, card_h, r=8, fill_color=CARD_BG, stroke_color=intent["color"], stroke_width=1)
        
        # Left color bar
        c.saveState()
        clip = c.beginPath()
        clip.roundRect(35, y - card_h, W-70, card_h, 8)
        c.clipPath(clip, stroke=0)
        c.setFillColor(intent["color"])
        c.rect(35, y - card_h, 5, card_h, fill=1, stroke=0)
        c.restoreState()
        
        # Name
        c.setFont('NanumSquareEB', 9.5)
        c.setFillColor(intent["color"])
        c.drawString(50, y - 16, intent["name"])
        
        # Example
        c.setFont('NanumSquareL', 7)
        c.setFillColor(LIGHT_TEXT)
        c.drawString(50, y - 32, intent["example"])
        
        # Strong AI
        c.setFont('NanumSquareB', 7.5)
        c.setFillColor(DARK_TEXT)
        c.drawString(50, y - 50, "강한 AI: " + intent["strong_ai"])
        
        # Strategy
        c.setFont('NanumSquareR', 7.5)
        c.setFillColor(MID_TEXT)
        c.drawString(50, y - 65, "전략: " + intent["strategy"])
        
        # Note
        c.setFont('NanumSquareB', 7)
        c.setFillColor(intent["color"])
        c.drawString(50, y - 80, "▶ " + intent["note"])
        
        # Blue ocean badge for FEAR
        if intent["name"].startswith("FEAR"):
            draw_rounded_rect(c, W - 140, y - 20, 78, 18, r=9, fill_color=ACCENT_ORANGE)
            c.setFont('NanumSquareEB', 7.5)
            c.setFillColor(white)
            c.drawCentredString(W - 101, y - 15, "블루오션!")
        
        y -= card_h + 8
    
    # Bottom message
    y -= 2
    draw_rounded_rect(c, 35, y - 33, W - 70, 31, r=8, fill_color=HexColor('#eef2ff'), stroke_color=ACCENT_INDIGO)
    c.setFont('NanumSquareEB', 9)
    c.setFillColor(ACCENT_INDIGO)
    c.drawCentredString(W/2, y - 14, "하나의 전략으로는 AI 시대에 대응 불가 — 질문 유형별 맞춤 전략이 필수입니다")
    c.setFont('NanumSquareR', 7.5)
    c.setFillColor(MID_TEXT)
    c.drawCentredString(W/2, y - 27, "특히 FEAR(공포) 영역은 아직 AI가 약합니다 — 지금 선점하면 독보적 위치를 확보할 수 있습니다")
    
    draw_footer(c, 5)


# ============ PAGE 6: 지금 당장 할 수 있는 AEO 액션 ============
def page_action_plan(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    draw_gradient_rect(c, 0, H-75, W, 75, HexColor('#0c4a6e'), HexColor('#0284c7'))
    c.setFont('NanumSquareEB', 20)
    c.setFillColor(white)
    c.drawString(40, H-50, "AEO 실전 액션 플랜")
    c.setFont('NanumSquareR', 10)
    c.setFillColor(HexColor('#bae6fd'))
    c.drawRightString(W-40, H-47, "지금 당장 실행할 수 있는 것들")
    
    y = H - 100
    
    c.setFont('NanumSquareR', 9)
    c.setFillColor(MID_TEXT)
    c.drawString(40, y, "이론보다 실행입니다. 단계별로 따라하시면 AI 가시성이 달라집니다.")
    y -= 28
    
    # Phase 1
    draw_rounded_rect(c, 35, y - 3, W-70, 22, r=6, fill_color=ACCENT_RED)
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(white)
    c.drawString(50, y + 2, "STEP 1  |  기본기 다지기 (1~2주)")
    c.setFont('NanumSquareR', 8)
    c.setFillColor(white)
    c.drawRightString(W - 50, y + 2, "이것만 해도 AI 가시성이 확 달라집니다")
    y -= 30
    
    step1_actions = [
        ("공식 웹사이트 구축 또는 업데이트", 
         "AI가 참조할 '공식 출처' 확보가 AEO의 첫 번째 조건",
         [
             "병원 소개, 진료 과목, 의료진 프로필, 진료 시간, 위치 정보 필수",
             "모바일 최적화 + HTTPS 적용 + 빠른 로딩 속도",
             "Perplexity는 URL을 직접 인용 — 웹사이트가 없으면 멘션 불가",
         ]),
        ("네이버 플레이스 완벽 관리",
         "Perplexity와 Claude가 적극 참조하는 핵심 데이터",
         [
             "평점 4.5 이상 유지, 리뷰 적극 관리 (답변 필수)",
             "영업시간, 주소, 전화번호, 사진 정확히 등록",
             "진료 메뉴, 가격 정보, 편의시설 정보까지 상세히",
         ]),
        ("전문의 프로필 상세 게시",
         "ChatGPT와 Claude의 멘션을 트리거하는 핵심 정보",
         [
             "전문의 자격, 졸업 대학, 수련 경력, 학회 활동, 논문",
             "웹사이트 + 네이버 + 구글 모두에 동일 정보 게시",
             "프로필 사진 + 한 줄 소개 + 전문 분야 명시",
         ]),
    ]
    
    for title, sub, items in step1_actions:
        draw_rounded_rect(c, 40, y - 70, W-80, 68, r=6, fill_color=CARD_BG, stroke_color=HexColor('#fecaca'))
        c.setFont('NanumSquareEB', 8.5)
        c.setFillColor(ACCENT_RED)
        c.drawString(52, y - 10, title)
        c.setFont('NanumSquareR', 7)
        c.setFillColor(MID_TEXT)
        c.drawString(52, y - 24, sub)
        iy = y - 38
        for item in items:
            c.setFillColor(ACCENT_RED)
            c.circle(58, iy + 3, 1.5, fill=1, stroke=0)
            c.setFont('NanumSquareR', 6.5)
            c.setFillColor(MID_TEXT)
            c.drawString(65, iy, item)
            iy -= 11
        y -= 76
    
    y -= 5
    
    # Phase 2
    draw_rounded_rect(c, 35, y - 3, W-70, 22, r=6, fill_color=ACCENT_ORANGE)
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(white)
    c.drawString(50, y + 2, "STEP 2  |  플랫폼별 전략 실행 (1개월)")
    c.setFont('NanumSquareR', 8)
    c.setFillColor(white)
    c.drawRightString(W - 50, y + 2, "각 AI별 맞춤 최적화")
    y -= 30
    
    step2 = [
        ("ChatGPT 공략", "브랜드 스토리 + 기술 디테일 콘텐츠 제작 — 시술별 경험, 첨단 장비 강조", CHATGPT_COLOR),
        ("Perplexity 공략", "가격 투명성 확보 + 구조화된 데이터(Schema) — 팩트 중심 간결한 정보", PERPLEXITY_COLOR),
        ("Gemini 공략", "시술별 FAQ + 지역 키워드 조합 — 다양한 검색 커버리지 확보", GEMINI_COLOR),
        ("Claude 공략", "환자 후기 관리 + 권위 키워드 — 웹사이트 상세도 극대화", CLAUDE_COLOR),
    ]
    
    for title, desc, color in step2:
        draw_rounded_rect(c, 40, y - 24, W - 80, 22, r=5, fill_color=CARD_BG, stroke_color=color)
        c.setFont('NanumSquareEB', 7.5)
        c.setFillColor(color)
        c.drawString(52, y - 8, title)
        c.setFont('NanumSquareR', 7)
        c.setFillColor(MID_TEXT)
        c.drawString(145, y - 8, desc)
        y -= 28
    
    y -= 5
    
    # Phase 3
    draw_rounded_rect(c, 35, y - 3, W-70, 22, r=6, fill_color=ACCENT_BLUE)
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(white)
    c.drawString(50, y + 2, "STEP 3  |  차별화 (3개월)")
    c.setFont('NanumSquareR', 8)
    c.setFillColor(white)
    c.drawRightString(W - 50, y + 2, "경쟁사 대비 확실한 우위")
    y -= 30
    
    step3 = [
        ("FEAR 콘텐츠 선점", "AI의 사각지대인 '공포/걱정' 영역을 블로그/영상으로 독점", ACCENT_RED),
        ("Google Business 최적화", "Gemini = Google AI — GBP가 곧 Gemini 최적화", GEMINI_COLOR),
        ("브랜드 스토리텔링", "개원 철학 + 환자 케어 시스템 콘텐츠화 — ChatGPT가 '이야기'를 중시", CHATGPT_COLOR),
    ]
    
    for title, desc, color in step3:
        draw_rounded_rect(c, 40, y - 24, W - 80, 22, r=5, fill_color=CARD_BG, stroke_color=color)
        c.setFont('NanumSquareEB', 7.5)
        c.setFillColor(color)
        c.drawString(52, y - 8, title)
        c.setFont('NanumSquareR', 7)
        c.setFillColor(MID_TEXT)
        c.drawString(178, y - 8, desc)
        y -= 28
    
    draw_footer(c, 6)


# ============ PAGE 7: AI별 한줄 공식 + CTA ============
def page_formula_and_cta(c):
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    draw_gradient_rect(c, 0, H-75, W, 75, HexColor('#1e1b4b'), HexColor('#4338ca'))
    c.setFont('NanumSquareEB', 20)
    c.setFillColor(white)
    c.drawString(40, H-50, "AI별 추천 공식 정리")
    c.setFont('NanumSquareR', 10)
    c.setFillColor(HexColor('#a5b4fc'))
    c.drawRightString(W-40, H-47, "한 눈에 보는 AEO 전략 요약")
    
    y = H - 100
    
    # Formula cards
    formulas = [
        {
            "name": "ChatGPT",
            "color": CHATGPT_COLOR,
            "formula": "전문의 자격 + 첨단 장비 + 시술 경험 + 브랜드 스토리",
            "result": "= 단독추천(R3) — 가장 강력한 추천",
            "tips": [
                "가장 길고 상세한 답변 — '이야기'가 있는 병원을 선호",
                "한번 추천하면 매우 긍정적으로 표현 (Sentiment 최고)",
                "TIP: 개원 철학, 환자 케어 시스템을 웹에 스토리로 작성",
            ],
        },
        {
            "name": "Perplexity",
            "color": PERPLEXITY_COLOR,
            "formula": "공식 웹사이트 + 네이버 평점 4.5+ + 가격 투명성",
            "result": "= 1위 독점 — 멘션하면 거의 1위",
            "tips": [
                "유일하게 네이버 평점/리뷰를 적극 인용하는 AI",
                "멘션율은 가장 낮지만, 1위 추천율은 압도적 최고",
                "TIP: 시술별 가격표 + 보험 적용 여부를 웹에 공개",
            ],
        },
        {
            "name": "Gemini",
            "color": GEMINI_COLOR,
            "formula": "다양한 키워드 + 지역 커버리지 + 전문의 자격",
            "result": "= 목록 진입 — 가장 자주 언급",
            "tips": [
                "가장 많은 병원을 나열 — 목록 진입은 가장 쉬움",
                "다만 1위 추천 비율은 가장 낮음 (양 > 질)",
                "TIP: 시술 다양화 + '강남 임플란트' 류 지역 키워드 확보",
            ],
        },
        {
            "name": "Claude",
            "color": CLAUDE_COLOR,
            "formula": "전문의 권위 + 웹&네이버 존재감 + 환자 후기",
            "result": "= 신뢰 기반 추천 — 후기에 가장 민감",
            "tips": [
                "웹사이트 의존도가 전 AI 중 가장 높음",
                "후기/리뷰 질문에서 압도적 1위 — 후기 관리 = Claude 공략",
                "TIP: 전문의 학력+경력+논문을 상세히 + 후기 적극 관리",
            ],
        },
    ]
    
    for f in formulas:
        card_h = 105
        draw_rounded_rect(c, 35, y - card_h, W-70, card_h, r=8, fill_color=CARD_BG, stroke_color=f["color"], stroke_width=1.2)
        
        # Top accent bar
        c.saveState()
        clip = c.beginPath()
        clip.roundRect(35, y - card_h, W-70, card_h, 8)
        c.clipPath(clip, stroke=0)
        c.setFillColor(f["color"])
        c.rect(35, y - 3, W-70, 3, fill=1, stroke=0)
        c.restoreState()
        
        # Name badge
        draw_rounded_rect(c, 48, y - 22, len(f["name"]) * 10 + 18, 18, r=9, fill_color=f["color"])
        c.setFont('NanumSquareEB', 8.5)
        c.setFillColor(white)
        c.drawString(56, y - 18, f["name"])
        
        # Formula
        c.setFont('NanumSquareEB', 9)
        c.setFillColor(DARK_TEXT)
        c.drawString(48, y - 38, f["formula"])
        c.setFont('NanumSquareB', 8.5)
        c.setFillColor(f["color"])
        c.drawString(48, y - 53, f["result"])
        
        # Tips
        ty = y - 68
        for tip in f["tips"]:
            c.setFillColor(f["color"])
            c.circle(55, ty + 3, 1.5, fill=1, stroke=0)
            c.setFont('NanumSquareR', 6.5)
            c.setFillColor(MID_TEXT)
            c.drawString(63, ty, tip)
            ty -= 11
        
        y -= card_h + 7
    
    y -= 5
    
    # Final CTA section
    draw_rounded_rect(c, 35, y - 100, W - 70, 98, r=12, fill_color=PRIMARY)
    
    c.setFont('NanumSquareEB', 14)
    c.setFillColor(ACCENT_CYAN)
    c.drawCentredString(W/2, y - 20, "AI 시대, 환자가 AI에게 물어보는 시대")
    
    c.setFont('NanumSquareR', 10)
    c.setFillColor(white)
    c.drawCentredString(W/2, y - 42, "SEO만으로는 부족합니다. AEO를 시작해야 합니다.")
    c.drawCentredString(W/2, y - 58, "지금이 경쟁 없이 AI 추천 상위권을 선점할 수 있는 유일한 타이밍입니다.")
    
    c.setFont('NanumSquareEB', 10)
    c.setFillColor(ACCENT_BLUE)
    c.drawCentredString(W/2, y - 80, "더 깊은 인사이트가 필요하시면 DM으로 문의해주세요")
    
    # Brand footer
    y -= 118
    c.setFont('NanumSquareEB', 11)
    c.setFillColor(DARK_TEXT)
    c.drawCentredString(W/2, y, "Patient Funnel")
    c.setFont('NanumSquareR', 8)
    c.setFillColor(MID_TEXT)
    c.drawCentredString(W/2, y - 16, "환자 경험 설계 전문 — 병원 경영의 새로운 기준")
    
    draw_footer(c, 7)


# ============ GENERATE ============
def generate():
    output_path = "/home/user/webapp/aeo_free_guide.pdf"
    c = canvas.Canvas(output_path, pagesize=A4)
    c.setTitle("AEO 완전 가이드 - AI에게 선택받는 병원이 되는 법")
    c.setAuthor("Patient Funnel")
    c.setSubject("AEO 무료 가이드 - 인스타그램 팔로워 배포용")
    
    page_cover(c)
    c.showPage()
    
    page_what_is_aeo(c)
    c.showPage()
    
    page_four_platforms(c)
    c.showPage()
    
    page_invisible_hospital(c)
    c.showPage()
    
    page_patient_questions(c)
    c.showPage()
    
    page_action_plan(c)
    c.showPage()
    
    page_formula_and_cta(c)
    c.showPage()
    
    c.save()
    
    size = os.path.getsize(output_path) / 1024
    print(f"PDF generated: {output_path}")
    print(f"File size: {size:.1f} KB")
    print(f"Pages: 7")

if __name__ == "__main__":
    generate()
