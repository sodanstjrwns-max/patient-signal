#!/usr/bin/env python3
"""
인스타그램 카드뉴스 생성 (1080x1080, 9장)
AEO 데이터 기반 — Patient Signal
"""

from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import mm
from PIL import Image, ImageDraw, ImageFont
import os
import textwrap

# ============ FONTS ============
FONT_DIR = "/usr/share/fonts/truetype/nanum/"
# PIL fonts
def get_font(name, size):
    font_map = {
        'EB': 'NanumSquareEB.ttf',
        'B': 'NanumSquareB.ttf',
        'R': 'NanumSquareR.ttf',
        'L': 'NanumSquareL.ttf',
        'RB': 'NanumSquareRoundB.ttf',
        'RR': 'NanumSquareRoundR.ttf',
    }
    return ImageFont.truetype(os.path.join(FONT_DIR, font_map[name]), size)

SIZE = 1080
OUTPUT_DIR = "/home/user/webapp/instagram_cards"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Colors
BG_DARK = "#0f172a"
BG_DARK2 = "#1e1b4b"
BG_WHITE = "#f8fafc"
BLUE = "#3b82f6"
INDIGO = "#6366f1"
PURPLE = "#8b5cf6"
TEAL = "#14b8a6"
GREEN = "#22c55e"
EMERALD = "#10b981"
ORANGE = "#f59e0b"
RED = "#ef4444"
ROSE = "#f43f5e"
CYAN = "#06b6d4"
CHATGPT = "#10a37f"
PERPLEXITY = "#20808d"
GEMINI = "#8e44ef"
CLAUDE = "#d97706"
DARK_TEXT = "#0f172a"
MID_TEXT = "#475569"
LIGHT_TEXT = "#94a3b8"


def draw_rounded_rect(draw, xy, radius, fill=None, outline=None, width=1):
    """Draw a rounded rectangle"""
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def draw_text_centered(draw, y, text, font, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    x = (SIZE - tw) / 2
    draw.text((x, y), text, font=font, fill=fill)


def draw_text_right(draw, x, y, text, font, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    draw.text((x - tw, y), text, font=font, fill=fill)


def add_watermark(draw):
    """Add Patient Signal watermark at bottom"""
    font_small = get_font('RR', 24)
    draw_text_centered(draw, SIZE - 55, "Patient Signal  |  patientsignal.co.kr", font_small, "#64748b")


def add_page_indicator(draw, current, total=9):
    """Add page indicator dots"""
    dot_r = 6
    gap = 22
    total_w = (total - 1) * gap
    start_x = (SIZE - total_w) / 2
    y = SIZE - 90
    for i in range(total):
        cx = start_x + i * gap
        color = BLUE if i == current - 1 else "#334155"
        draw.ellipse([cx - dot_r, y - dot_r, cx + dot_r, y + dot_r], fill=color)


# ============ CARD 1: COVER ============
def card_01_cover():
    img = Image.new('RGB', (SIZE, SIZE), BG_DARK)
    draw = ImageDraw.Draw(img)
    
    # Decorative circles
    draw.ellipse([700, 50, 1200, 550], fill="#1e1b4b")
    draw.ellipse([-100, 600, 400, 1100], fill="#1e1b4b")
    
    # Badge
    draw_rounded_rect(draw, (SIZE//2 - 140, 180, SIZE//2 + 140, 220), radius=20, fill="#1e1b4b", outline=INDIGO, width=2)
    font_badge = get_font('B', 24)
    draw_text_centered(draw, 186, "데이터로 증명하는 AI 시대 병원 마케팅", font_badge, BLUE)
    
    # Title
    font_title = get_font('EB', 72)
    draw_text_centered(draw, 280, "AI에게", font_title, "white")
    draw_text_centered(draw, 370, "추천받는 병원의", font_title, "white")
    draw_text_centered(draw, 460, "비밀", font_title, CYAN)
    
    # Subtitle
    font_sub = get_font('R', 32)
    draw_text_centered(draw, 580, "ChatGPT · Perplexity · Gemini · Claude", font_sub, LIGHT_TEXT)
    draw_text_centered(draw, 625, "실제 AI 응답 분석 결과 공개", font_sub, LIGHT_TEXT)
    
    # Divider
    draw.line([(SIZE//2 - 60, 700), (SIZE//2 + 60, 700)], fill=BLUE, width=3)
    
    # Brand
    font_brand = get_font('EB', 28)
    draw_text_centered(draw, 730, "Patient Signal", font_brand, "white")
    font_url = get_font('R', 22)
    draw_text_centered(draw, 770, "AI 가시성 모니터링 플랫폼", font_url, LIGHT_TEXT)
    
    add_page_indicator(draw, 1)
    img.save(os.path.join(OUTPUT_DIR, "card_01_cover.png"), quality=95)
    print("Card 1: Cover ✓")


# ============ CARD 2: 충격적 사실 ============
def card_02_shocking():
    img = Image.new('RGB', (SIZE, SIZE), BG_DARK)
    draw = ImageDraw.Draw(img)
    
    # Decorative
    draw.ellipse([750, -100, 1250, 400], fill="#1e1b4b")
    
    font_q = get_font('EB', 36)
    draw_text_centered(draw, 80, "알고 계셨나요?", font_q, ORANGE)
    
    font_big = get_font('EB', 52)
    draw_text_centered(draw, 160, "AI에게 한 번도", font_big, "white")
    draw_text_centered(draw, 225, "추천되지 않는 병원이", font_big, "white")
    
    # Big number
    font_huge = get_font('EB', 120)
    draw_text_centered(draw, 310, "78%", font_huge, RED)
    
    font_desc = get_font('R', 30)
    draw_text_centered(draw, 450, "분석 대상 병원 중 대다수가", font_desc, LIGHT_TEXT)
    draw_text_centered(draw, 490, "AI 추천 영역에서 '보이지 않는 병원'입니다", font_desc, LIGHT_TEXT)
    
    # Divider line
    draw.line([(100, 560), (SIZE-100, 560)], fill="#334155", width=1)
    
    # Key fact boxes
    facts = [
        ("1위 병원 점수", "79점", GREEN),
        ("평균 점수", "31.8점", BLUE),
        ("하위권 점수", "6.4점", RED),
    ]
    box_w = 280
    gap = 30
    start_x = (SIZE - (box_w * 3 + gap * 2)) / 2
    
    for i, (label, val, color) in enumerate(facts):
        bx = start_x + i * (box_w + gap)
        draw_rounded_rect(draw, (bx, 600, bx + box_w, 720), radius=16, fill="#1e293b", outline=color, width=2)
        font_val = get_font('EB', 48)
        bbox = draw.textbbox((0, 0), val, font=font_val)
        tw = bbox[2] - bbox[0]
        draw.text((bx + (box_w - tw)/2, 615), val, font=font_val, fill=color)
        font_lbl = get_font('R', 22)
        bbox2 = draw.textbbox((0, 0), label, font=font_lbl)
        tw2 = bbox2[2] - bbox2[0]
        draw.text((bx + (box_w - tw2)/2, 680), label, font=font_lbl, fill=LIGHT_TEXT)
    
    # Gap emphasis
    font_gap = get_font('EB', 30)
    draw_text_centered(draw, 760, "1위와 하위권의 격차: 10.8배", font_gap, ORANGE)
    font_msg = get_font('R', 24)
    draw_text_centered(draw, 805, "지금이 선점 기회입니다", font_msg, LIGHT_TEXT)
    
    add_page_indicator(draw, 2)
    add_watermark(draw)
    img.save(os.path.join(OUTPUT_DIR, "card_02_shocking.png"), quality=95)
    print("Card 2: Shocking fact ✓")


# ============ CARD 3: 결정적 차이 ============
def card_03_critical_difference():
    img = Image.new('RGB', (SIZE, SIZE), BG_DARK)
    draw = ImageDraw.Draw(img)
    
    font_title = get_font('EB', 42)
    draw_text_centered(draw, 60, "AI 추천의 결정적 차이", font_title, "white")
    
    font_sub = get_font('R', 26)
    draw_text_centered(draw, 120, "웹사이트 + 네이버 플레이스 보유 여부", font_sub, CYAN)
    
    # VS comparison
    # Left: Has both
    left_x = 60
    box_w = 450
    draw_rounded_rect(draw, (left_x, 190, left_x + box_w, 520), radius=20, fill="#0f3d2e", outline=GREEN, width=2)
    
    font_has = get_font('EB', 30)
    draw.text((left_x + 30, 210), "웹+네이버 보유 병원", font=font_has, fill=GREEN)
    
    left_items = [
        ("AI 멘션수", "약 3배 높음", GREEN),
        ("평균 점수", "상위 30%", GREEN),
        ("전 플랫폼", "고르게 멘션", GREEN),
    ]
    iy = 270
    for label, val, color in left_items:
        font_item = get_font('R', 26)
        draw.text((left_x + 40, iy), label, font=font_item, fill=LIGHT_TEXT)
        font_val = get_font('EB', 32)
        draw.text((left_x + 40, iy + 35), val, font=font_val, fill=color)
        iy += 80
    
    # Right: Missing
    right_x = 570
    draw_rounded_rect(draw, (right_x, 190, right_x + box_w, 520), radius=20, fill="#3d1515", outline=RED, width=2)
    
    draw.text((right_x + 30, 210), "둘 다 미보유 병원", font=font_has, fill=RED)
    
    right_items = [
        ("AI 멘션수", "거의 0", RED),
        ("평균 점수", "하위 10%", RED),
        ("전 플랫폼", "멘션 전무", RED),
    ]
    iy = 270
    for label, val, color in right_items:
        draw.text((right_x + 40, iy), label, font=font_item, fill=LIGHT_TEXT)
        font_val = get_font('EB', 32)
        draw.text((right_x + 40, iy + 35), val, font=font_val, fill=color)
        iy += 80
    
    # VS badge
    draw.ellipse([SIZE//2 - 35, 330, SIZE//2 + 35, 400], fill=ORANGE)
    font_vs = get_font('EB', 28)
    bbox = draw.textbbox((0, 0), "VS", font=font_vs)
    tw = bbox[2] - bbox[0]
    draw.text((SIZE//2 - tw//2, 350), "VS", font=font_vs, fill="white")
    
    # Bottom message
    draw_rounded_rect(draw, (60, 560, SIZE-60, 680), radius=16, fill="#1e1b4b", outline=INDIGO, width=1)
    font_msg = get_font('EB', 32)
    draw_text_centered(draw, 580, "이 두 가지만 갖춰도", font_msg, "white")
    draw_text_centered(draw, 625, "AI 가시성 상위 30% 진입 가능", font_msg, CYAN)
    
    # Subtext
    font_small = get_font('R', 22)
    draw_text_centered(draw, 710, "BOTTOM 10의 공통점: 네이버 보유율 0%", font_small, RED)
    draw_text_centered(draw, 745, "AI에게 아예 '존재하지 않는 병원'입니다", font_small, LIGHT_TEXT)
    
    add_page_indicator(draw, 3)
    add_watermark(draw)
    img.save(os.path.join(OUTPUT_DIR, "card_03_critical.png"), quality=95)
    print("Card 3: Critical difference ✓")


# ============ CARD 4: 4개 AI 플랫폼 비교 ============
def card_04_platforms():
    img = Image.new('RGB', (SIZE, SIZE), BG_DARK)
    draw = ImageDraw.Draw(img)
    
    font_title = get_font('EB', 40)
    draw_text_centered(draw, 50, "4개 AI 플랫폼", font_title, "white")
    draw_text_centered(draw, 100, "완전히 다른 전략이 필요합니다", font_title, CYAN)
    
    platforms = [
        ("ChatGPT", "28.0%", "멘션 시 61.9%가 1위 추천", "Sentiment +0.97 최고", CHATGPT, 190),
        ("Perplexity", "14.4%", "멘션 시 71.0%가 1위 추천!", "R3 단독추천 비중 33.7%", PERPLEXITY, 380),
        ("Gemini", "34.9%", "가장 관대한 멘션 (1위!)", "1위 추천 33.5%로 낮음", GEMINI, 570),
        ("Claude", "25.2%", "웹사이트 의존도 66.9%", "후기 질문 멘션 46.0%", CLAUDE, 760),
    ]
    
    for name, rate, line1, line2, color, py in platforms:
        draw_rounded_rect(draw, (60, py, SIZE-60, py + 155), radius=16, fill="#1e293b", outline=color, width=2)
        
        # Color bar
        draw_rounded_rect(draw, (60, py, 72, py + 155), radius=5, fill=color)
        
        # Platform name
        font_name = get_font('EB', 32)
        draw.text((90, py + 12), name, font=font_name, fill=color)
        
        # Rate
        font_rate = get_font('EB', 48)
        draw_text_right(draw, SIZE - 80, py + 8, rate, font_rate, "white")
        font_rate_label = get_font('R', 18)
        draw_text_right(draw, SIZE - 80, py + 62, "멘션율", font_rate_label, LIGHT_TEXT)
        
        # Details
        font_detail = get_font('R', 24)
        draw.text((90, py + 70), line1, font=font_detail, fill="#cbd5e1")
        font_detail2 = get_font('B', 22)
        draw.text((90, py + 105), line2, font=font_detail2, fill=LIGHT_TEXT)
    
    add_page_indicator(draw, 4)
    add_watermark(draw)
    img.save(os.path.join(OUTPUT_DIR, "card_04_platforms.png"), quality=95)
    print("Card 4: Platform comparison ✓")


# ============ CARD 5: Perplexity의 역설 ============
def card_05_perplexity():
    img = Image.new('RGB', (SIZE, SIZE), BG_DARK)
    draw = ImageDraw.Draw(img)
    
    draw.ellipse([700, -100, 1300, 500], fill="#0f3d3d")
    
    font_tag = get_font('B', 26)
    draw_text_centered(draw, 50, "가장 주목해야 할 AI", font_tag, TEAL)
    
    font_title = get_font('EB', 52)
    draw_text_centered(draw, 110, "Perplexity의 역설", font_title, "white")
    
    # Big stat
    font_rate = get_font('EB', 44)
    draw_text_centered(draw, 210, "멘션율 14.4% → 최저", font_rate, LIGHT_TEXT)
    
    font_but = get_font('EB', 36)
    draw_text_centered(draw, 275, "그러나...", font_but, ORANGE)
    
    # Key stats boxes
    stats = [
        ("멘션 시 1위 추천율", "71.0%", "4개 플랫폼 중 압도적 1위"),
        ("R3(단독추천) 비중", "33.7%", "멘션 3번 중 1번은 단독추천"),
        ("네이버 참조율", "30%+", "유일하게 네이버 평점 인용"),
    ]
    
    sy = 350
    for label, val, desc in stats:
        draw_rounded_rect(draw, (80, sy, SIZE-80, sy + 110), radius=14, fill="#0f3d3d", outline=TEAL, width=1)
        font_lbl = get_font('R', 22)
        draw.text((110, sy + 12), label, font=font_lbl, fill=LIGHT_TEXT)
        font_val = get_font('EB', 52)
        draw.text((110, sy + 40), val, font=font_val, fill=TEAL)
        font_desc = get_font('R', 20)
        draw_text_right(draw, SIZE - 110, sy + 70, desc, font_desc, "#5eead4")
        sy += 125
    
    # Conclusion
    draw_rounded_rect(draw, (80, 740, SIZE-80, 820), radius=14, fill=PERPLEXITY)
    font_conclusion = get_font('EB', 28)
    draw_text_centered(draw, 755, "결론: Perplexity 1회 멘션 ≈", font_conclusion, "white")
    draw_text_centered(draw, 790, "Gemini 18회 멘션의 가치 (R3 기준)", font_conclusion, "white")
    
    add_page_indicator(draw, 5)
    add_watermark(draw)
    img.save(os.path.join(OUTPUT_DIR, "card_05_perplexity.png"), quality=95)
    print("Card 5: Perplexity paradox ✓")


# ============ CARD 6: 환자 질문 의도별 AI 반응 ============
def card_06_intent():
    img = Image.new('RGB', (SIZE, SIZE), BG_DARK)
    draw = ImageDraw.Draw(img)
    
    font_title = get_font('EB', 38)
    draw_text_centered(draw, 50, "환자가 AI에게 묻는 5가지", font_title, "white")
    font_sub = get_font('R', 26)
    draw_text_centered(draw, 100, "질문 의도별로 최강 AI가 다릅니다", font_sub, CYAN)
    
    intents = [
        ("비교 질문", "'OO 잘하는 곳 추천'", "Gemini 80.6%", GEMINI, PURPLE),
        ("정보 탐색", "'임플란트 과정 알려줘'", "Gemini 52.8%", GEMINI, BLUE),
        ("후기 확인", "'OO병원 어때요?'", "Claude 46.0%", CLAUDE, ORANGE),
        ("예약 문의", "'영업시간, 가격'", "ChatGPT·Per 5.7%", CHATGPT, TEAL),
        ("공포/걱정", "'아프나요? 실패하면?'", "전체 <6%", RED, RED),
    ]
    
    sy = 170
    for title, example, best, best_color, accent in intents:
        draw_rounded_rect(draw, (60, sy, SIZE-60, sy + 135), radius=14, fill="#1e293b")
        
        # Left color bar
        draw_rounded_rect(draw, (60, sy, 75, sy + 135), radius=5, fill=accent)
        
        font_intent = get_font('EB', 30)
        draw.text((95, sy + 12), title, font=font_intent, fill="white")
        
        font_ex = get_font('R', 22)
        draw.text((95, sy + 52), example, font=font_ex, fill=LIGHT_TEXT)
        
        # Best platform badge
        font_best = get_font('EB', 26)
        draw.text((95, sy + 88), best, font=font_best, fill=accent)
        
        if title == "공포/걱정":
            font_opp = get_font('B', 20)
            draw_text_right(draw, SIZE - 80, sy + 92, "← 블루오션!", font_opp, ORANGE)
        
        sy += 148
    
    # Bottom message
    font_msg = get_font('B', 24)
    draw_text_centered(draw, 920, "하나의 SEO로는 AI 시대에 대응 불가 → 플랫폼별 전략 필수", font_msg, LIGHT_TEXT)
    
    add_page_indicator(draw, 6)
    add_watermark(draw)
    img.save(os.path.join(OUTPUT_DIR, "card_06_intent.png"), quality=95)
    print("Card 6: Intent matrix ✓")


# ============ CARD 7: 지금 당장 해야 할 3가지 ============
def card_07_actions():
    img = Image.new('RGB', (SIZE, SIZE), BG_DARK)
    draw = ImageDraw.Draw(img)
    
    font_title = get_font('EB', 42)
    draw_text_centered(draw, 50, "지금 당장", font_title, "white")
    draw_text_centered(draw, 105, "해야 할 3가지", font_title, CYAN)
    
    font_desc = get_font('R', 24)
    draw_text_centered(draw, 165, "이것만 해도 AI 가시성이 확 달라집니다", font_desc, LIGHT_TEXT)
    
    actions = [
        ("1", "공식 웹사이트 구축", 
         "AI 추천의 절대 기본기",
         "웹사이트 미보유 시 AI가 '존재하지\n않는 병원'으로 인식합니다", RED),
        ("2", "네이버 플레이스 최적화",
         "Perplexity·Claude 공략 핵심",
         "평점 4.5 이상, 영업시간, 사진\n리뷰 적극 관리 필수", ORANGE),
        ("3", "전문의 프로필 상세 게시",
         "ChatGPT·Claude 멘션 트리거",
         "학력+자격+경력+학회 활동을\n웹에 명확히 기재", GREEN),
    ]
    
    sy = 230
    for num, title, subtitle, desc, color in actions:
        draw_rounded_rect(draw, (60, sy, SIZE-60, sy + 200), radius=18, fill="#1e293b", outline=color, width=2)
        
        # Number circle
        draw.ellipse([90, sy + 20, 160, sy + 90], fill=color)
        font_num = get_font('EB', 44)
        bbox = draw.textbbox((0, 0), num, font=font_num)
        tw = bbox[2] - bbox[0]
        draw.text((125 - tw//2, sy + 28), num, font=font_num, fill="white")
        
        # Title
        font_action = get_font('EB', 32)
        draw.text((180, sy + 22), title, font=font_action, fill="white")
        
        # Subtitle
        font_sub = get_font('B', 22)
        draw.text((180, sy + 65), subtitle, font=font_sub, fill=color)
        
        # Description
        font_d = get_font('R', 21)
        for j, line in enumerate(desc.split('\n')):
            draw.text((180, sy + 105 + j * 30), line, font=font_d, fill=LIGHT_TEXT)
        
        sy += 220
    
    add_page_indicator(draw, 7)
    add_watermark(draw)
    img.save(os.path.join(OUTPUT_DIR, "card_07_actions.png"), quality=95)
    print("Card 7: Actions ✓")


# ============ CARD 8: AI별 한줄 공식 ============
def card_08_formulas():
    img = Image.new('RGB', (SIZE, SIZE), BG_DARK)
    draw = ImageDraw.Draw(img)
    
    font_title = get_font('EB', 42)
    draw_text_centered(draw, 50, "AI별 추천 공식", font_title, "white")
    font_sub = get_font('R', 26)
    draw_text_centered(draw, 105, "각 AI가 병원을 추천하는 핵심 기준", font_sub, LIGHT_TEXT)
    
    formulas = [
        ("ChatGPT", CHATGPT,
         "전문의 자격 + 디지털 장비",
         "+ 시술별 경험 = 단독추천(R3)",
         "가장 길고 상세한 응답, Sentiment +0.97 최고 긍정"),
        ("Perplexity", PERPLEXITY,
         "웹사이트 + 네이버 평점 4.5+",
         "+ 가격 투명성 = 1위 독점",
         "출처 기반 검증 AI — 멘션하면 71%가 1위"),
        ("Gemini", GEMINI,
         "다양한 키워드 + 지역 커버리지",
         "+ 전문의 자격 = 노출 확보",
         "가장 관대한 멘션 34.9% — '목록 진입' 전략"),
        ("Claude", CLAUDE,
         "전문의 권위 + 웹 & 네이버",
         "+ 후기/리뷰 = 강력 멘션",
         "웹 의존도 66.9% 최고 — 권위 기반 추천"),
    ]
    
    sy = 175
    for name, color, line1, line2, note in formulas:
        draw_rounded_rect(draw, (60, sy, SIZE-60, sy + 175), radius=16, fill="#1e293b", outline=color, width=2)
        
        # Platform name badge
        draw_rounded_rect(draw, (85, sy + 15, 85 + len(name) * 22 + 30, sy + 55), radius=12, fill=color)
        font_name = get_font('EB', 26)
        draw.text((100, sy + 18), name, font=font_name, fill="white")
        
        # Formula
        font_formula = get_font('EB', 28)
        draw.text((85, sy + 70), line1, font=font_formula, fill="white")
        draw.text((85, sy + 105), line2, font=font_formula, fill=color)
        
        # Note
        font_note = get_font('R', 20)
        draw.text((85, sy + 143), note, font=font_note, fill=LIGHT_TEXT)
        
        sy += 190
    
    add_page_indicator(draw, 8)
    add_watermark(draw)
    img.save(os.path.join(OUTPUT_DIR, "card_08_formulas.png"), quality=95)
    print("Card 8: Formulas ✓")


# ============ CARD 9: CTA ============
def card_09_cta():
    img = Image.new('RGB', (SIZE, SIZE), BG_DARK)
    draw = ImageDraw.Draw(img)
    
    # Decorative
    draw.ellipse([600, -100, 1200, 500], fill="#1e1b4b")
    draw.ellipse([-200, 500, 400, 1100], fill="#1e1b4b")
    
    font_q = get_font('EB', 36)
    draw_text_centered(draw, 120, "AI 시대,", font_q, LIGHT_TEXT)
    
    font_title = get_font('EB', 52)
    draw_text_centered(draw, 190, "환자가 AI에게", font_title, "white")
    draw_text_centered(draw, 260, "물어보는 시대", font_title, "white")
    
    # Divider
    draw.line([(SIZE//2 - 80, 340), (SIZE//2 + 80, 340)], fill=BLUE, width=3)
    
    font_big_q = get_font('EB', 44)
    draw_text_centered(draw, 380, "우리 병원은", font_big_q, CYAN)
    draw_text_centered(draw, 440, "준비되어 있나요?", font_big_q, CYAN)
    
    # Stats reminder
    font_stats = get_font('R', 26)
    draw_text_centered(draw, 530, "1위 병원: 79점  |  평균: 31.8점  |  격차: 10.8배", font_stats, LIGHT_TEXT)
    
    # CTA Box
    draw_rounded_rect(draw, (120, 610, SIZE-120, 780), radius=20, fill=BLUE)
    font_cta = get_font('EB', 36)
    draw_text_centered(draw, 635, "내 병원의 AI 가시성", font_cta, "white")
    draw_text_centered(draw, 685, "지금 확인하기", font_cta, "white")
    font_url = get_font('B', 26)
    draw_text_centered(draw, 738, "patientsignal.co.kr", font_url, "#bfdbfe")
    
    # Brand
    font_brand = get_font('EB', 30)
    draw_text_centered(draw, 830, "Patient Signal", font_brand, "white")
    font_desc = get_font('R', 22)
    draw_text_centered(draw, 870, "AI 가시성 모니터링 & 최적화 플랫폼", font_desc, LIGHT_TEXT)
    
    add_page_indicator(draw, 9)
    img.save(os.path.join(OUTPUT_DIR, "card_09_cta.png"), quality=95)
    print("Card 9: CTA ✓")


# ============ GENERATE ALL ============
def generate_all():
    print("Generating Instagram Card News (9 cards)...")
    print(f"Output: {OUTPUT_DIR}")
    print("=" * 50)
    
    card_01_cover()
    card_02_shocking()
    card_03_critical_difference()
    card_04_platforms()
    card_05_perplexity()
    card_06_intent()
    card_07_actions()
    card_08_formulas()
    card_09_cta()
    
    print("=" * 50)
    print(f"All 9 cards generated in {OUTPUT_DIR}")
    
    # List files
    for f in sorted(os.listdir(OUTPUT_DIR)):
        fp = os.path.join(OUTPUT_DIR, f)
        print(f"  {f} ({os.path.getsize(fp) / 1024:.0f} KB)")

if __name__ == "__main__":
    generate_all()
