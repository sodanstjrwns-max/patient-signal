#!/usr/bin/env python3
"""
서울비디치과 AI 가시성(AEO) 진단 & 개선 전략 보고서
Patient Signal 실측 데이터 기반 (2026-07-02)
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether, Image
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import numpy as np
import io
from datetime import datetime

# ── 폰트 등록 ──
FONT_DIR = '/usr/share/fonts/truetype/nanum/'
pdfmetrics.registerFont(TTFont('NanumSquare', FONT_DIR + 'NanumSquareR.ttf'))
pdfmetrics.registerFont(TTFont('NanumSquareB', FONT_DIR + 'NanumSquareB.ttf'))
pdfmetrics.registerFont(TTFont('NanumSquareEB', FONT_DIR + 'NanumSquareEB.ttf'))
pdfmetrics.registerFont(TTFont('NanumSquareL', FONT_DIR + 'NanumSquareL.ttf'))

# matplotlib 한글 폰트
mpl_font = fm.FontProperties(fname=FONT_DIR + 'NanumSquareB.ttf')
fm.fontManager.addfont(FONT_DIR + 'NanumSquareB.ttf')
plt.rcParams['font.family'] = fm.FontProperties(fname=FONT_DIR + 'NanumSquareB.ttf').get_name()
plt.rcParams['axes.unicode_minus'] = False

# ── 컬러 팔레트 ──
C_PRIMARY = colors.HexColor('#1a1a2e')
C_ACCENT = colors.HexColor('#6C63FF')
C_GPT = colors.HexColor('#10A37F')
C_PERPLEXITY = colors.HexColor('#20808D')
C_GEMINI = colors.HexColor('#4285F4')
C_CLAUDE = colors.HexColor('#D97706')
C_GROK = colors.HexColor('#333333')
C_BG_LIGHT = colors.HexColor('#F8F9FA')
C_TEXT = colors.HexColor('#2D3436')
C_TEXT_LIGHT = colors.HexColor('#636E72')
C_RED = colors.HexColor('#E74C3C')
C_GREEN = colors.HexColor('#27AE60')
C_ORANGE = colors.HexColor('#F39C12')
C_WHITE = colors.white

# ── 스타일 ──
def make_style(name, fontName='NanumSquare', fontSize=10, textColor=C_TEXT,
               alignment=TA_LEFT, spaceAfter=4, spaceBefore=0, leading=None,
               leftIndent=0):
    if leading is None:
        leading = fontSize * 1.5
    return ParagraphStyle(name, fontName=fontName, fontSize=fontSize,
                          textColor=textColor, alignment=alignment,
                          spaceAfter=spaceAfter, spaceBefore=spaceBefore,
                          leading=leading, leftIndent=leftIndent)

S_TITLE = make_style('T', 'NanumSquareEB', 26, C_PRIMARY, TA_CENTER, 8, leading=34)
S_SUBTITLE = make_style('ST', 'NanumSquare', 13, C_TEXT_LIGHT, TA_CENTER, 18, leading=19)
S_H1 = make_style('H1', 'NanumSquareEB', 18, C_PRIMARY, spaceAfter=10, spaceBefore=14, leading=26)
S_H2 = make_style('H2', 'NanumSquareB', 14, C_ACCENT, spaceAfter=7, spaceBefore=10, leading=20)
S_H3 = make_style('H3', 'NanumSquareB', 11.5, C_PRIMARY, spaceAfter=5, spaceBefore=7, leading=17)
S_BODY = make_style('B', 'NanumSquare', 10, C_TEXT, spaceAfter=4, leading=16)
S_BODY_J = make_style('BJ', 'NanumSquare', 10, C_TEXT, TA_JUSTIFY, 4, leading=16)
S_SMALL = make_style('SM', 'NanumSquareL', 8, C_TEXT_LIGHT, spaceAfter=2, leading=12)
S_BULLET = make_style('BU', 'NanumSquare', 10, C_TEXT, spaceAfter=3, leading=16, leftIndent=16)
S_CENTER = make_style('C', 'NanumSquare', 10, C_TEXT, TA_CENTER, 4, leading=16)

def hr(color=C_ACCENT, thickness=1):
    return HRFlowable(width='100%', thickness=thickness, color=color, spaceAfter=8, spaceBefore=8)

def spacer(h=5):
    return Spacer(1, h * mm)

def colored_box(text, bg, tc=C_WHITE, font='NanumSquareB', size=11, pad=10):
    st = ParagraphStyle('bx', fontName=font, fontSize=size, textColor=tc,
                        alignment=TA_LEFT, leading=size * 1.5)
    t = Table([[Paragraph(text, st)]], colWidths=['100%'])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg),
        ('TOPPADDING', (0, 0), (-1, -1), pad),
        ('BOTTOMPADDING', (0, 0), (-1, -1), pad),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
    ]))
    return t

def stat_row(cards):
    """cards: list of (label, value, sub, color)"""
    cells = []
    for label, value, sub, color in cards:
        inner = [
            [Paragraph(f'<font name="NanumSquareEB" size="20" color="{color.hexval()}">{value}</font>',
                       make_style('v', alignment=TA_CENTER, leading=26))],
            [Paragraph(f'<font name="NanumSquareB" size="9" color="#2D3436">{label}</font>',
                       make_style('l', alignment=TA_CENTER, leading=13))],
        ]
        if sub:
            inner.append([Paragraph(f'<font name="NanumSquareL" size="7.5" color="#636E72">{sub}</font>',
                                    make_style('s', alignment=TA_CENTER, leading=11))])
        it = Table(inner)
        it.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        cells.append(it)
    n = len(cells)
    t = Table([cells], colWidths=[(170 / n) * mm] * n)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), C_BG_LIGHT),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ('LINEAFTER', (0, 0), (-2, -1), 0.5, colors.HexColor('#E0E0E0')),
    ]))
    return t

def data_table(headers, rows, col_widths=None, header_bg=C_PRIMARY, highlight_rows=None, highlight_bg=None):
    th = ParagraphStyle('th', fontName='NanumSquareB', fontSize=9, textColor=C_WHITE,
                        alignment=TA_CENTER, leading=13)
    td = ParagraphStyle('td', fontName='NanumSquare', fontSize=9, textColor=C_TEXT,
                        alignment=TA_CENTER, leading=13)
    tdl = ParagraphStyle('tdl', fontName='NanumSquare', fontSize=9, textColor=C_TEXT,
                         alignment=TA_LEFT, leading=13)
    data = [[Paragraph(h, th) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), tdl if i == 0 else td) for i, c in enumerate(row)])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), header_bg),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [C_WHITE, C_BG_LIGHT]),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#DEE2E6')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]
    if highlight_rows:
        for r in highlight_rows:
            style.append(('BACKGROUND', (0, r + 1), (-1, r + 1), highlight_bg or colors.HexColor('#FFF3CD')))
    t.setStyle(TableStyle(style))
    return t

def fig_to_image(fig, width_mm=170, dpi=150):
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=dpi, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    buf.seek(0)
    from PIL import Image as PILImage
    pil = PILImage.open(buf)
    w, h = pil.size
    buf.seek(0)
    return Image(buf, width=width_mm * mm, height=(width_mm * h / w) * mm)

# ═══════════════ 데이터 (2026-07-02 Patient Signal 프로덕션 실측) ═══════════════
PLATFORMS = ['ChatGPT', 'Claude', 'Perplexity', 'Gemini', 'Grok']
VD_SCORES = [37, 57, 31, 34, 4]
TOP_AVG = [49, 39, 49, 85, 0]
GAPS = [-12, +18, -18, -51, +4]
PLAT_COLORS = ['#10A37F', '#D97706', '#20808D', '#4285F4', '#333333']

story = []

# ═══════════════ 표지 ═══════════════
story.append(spacer(30))
story.append(Paragraph('서울비디치과', make_style('cv0', 'NanumSquareB', 14, C_ACCENT, TA_CENTER, 6)))
story.append(Paragraph('AI 가시성(AEO) 진단 & 개선 전략 보고서', S_TITLE))
story.append(Paragraph('AI가 추천하는 치과가 되기 위한 데이터 기반 처방전', S_SUBTITLE))
story.append(spacer(8))
story.append(colored_box(
    '<font name="NanumSquareEB" size="13">핵심 요약</font><br/><br/>'
    '종합점수 <font name="NanumSquareEB" color="#FFD700">63점 / 전체 16위</font> (94개 병원 중, 상위 17%)<br/>'
    '브랜드 질문은 만점(25/25), 그러나 <font name="NanumSquareEB" color="#FF6B6B">가격·비용 질문에서 사실상 전멸</font><br/>'
    '최대 약점 채널: <font name="NanumSquareEB" color="#FF6B6B">Gemini (상위그룹 대비 -51점)</font> — 여기가 승부처',
    C_PRIMARY, pad=16))
story.append(spacer(60))
story.append(Paragraph(f'발행일: {datetime.now().strftime("%Y년 %m월 %d일")}', S_CENTER))
story.append(Paragraph('데이터 출처: Patient Signal — 6개 AI 플랫폼 × 101개 프롬프트 × 최근 7일 실측', S_CENTER))
story.append(Paragraph('Patient Signal | AI 시대의 병원 가시성 측정 표준', S_SMALL))
story.append(PageBreak())

# ═══════════════ 1. 현재 위치 진단 ═══════════════
story.append(Paragraph('1. 현재 위치 — 우리는 어디에 서 있는가', S_H1))
story.append(hr())
story.append(Paragraph(
    'Patient Signal이 측정하는 94개 병원 가운데 서울비디치과(불당본점)는 종합점수 63점으로 전체 16위, '
    '상위 17%(Silver 등급)에 위치합니다. 1위 병원(89점)과의 격차는 26점이며, 바로 위 순위와는 단 2점 차이입니다. '
    '나쁘지 않은 성적이지만, 병원 규모와 브랜드 파워를 고려하면 "체급 대비 저평가" 상태입니다.', S_BODY_J))
story.append(spacer(4))
story.append(stat_row([
    ('종합점수', '63점', '/100', C_ACCENT),
    ('전체 순위', '16위', '94개 병원 중', C_PRIMARY),
    ('상위', '17%', 'Silver 등급', C_ORANGE),
    ('다음 순위까지', '2점', '추월 사정권', C_GREEN),
]))
story.append(spacer(6))

story.append(Paragraph('1-1. 플랫폼별 점수: 나 vs 상위그룹(63점 초과 15개 병원 평균)', S_H2))

# 차트: 플랫폼별 비교 바차트
fig, ax = plt.subplots(figsize=(9, 4.2))
x = np.arange(len(PLATFORMS))
w = 0.36
b1 = ax.bar(x - w/2, VD_SCORES, w, label='서울비디치과', color='#6C63FF', zorder=3)
b2 = ax.bar(x + w/2, TOP_AVG, w, label='상위그룹 평균', color='#CBD5E1', zorder=3)
for i, (v, t) in enumerate(zip(VD_SCORES, TOP_AVG)):
    ax.text(i - w/2, v + 1.5, str(v), ha='center', fontsize=11, fontweight='bold', color='#6C63FF')
    ax.text(i + w/2, t + 1.5, str(t), ha='center', fontsize=11, color='#64748B')
    gap = GAPS[i]
    col = '#E74C3C' if gap < 0 else '#27AE60'
    ax.text(i, max(v, t) + 9, f'{gap:+d}', ha='center', fontsize=12, fontweight='bold', color=col)
ax.set_xticks(x)
ax.set_xticklabels(PLATFORMS, fontsize=11)
ax.set_ylim(0, 105)
ax.set_ylabel('플랫폼 점수')
ax.legend(fontsize=10, loc='upper left')
ax.grid(axis='y', alpha=0.25, zorder=0)
ax.spines[['top', 'right']].set_visible(False)
ax.set_title('플랫폼별 점수 격차 (숫자 = 상위그룹 대비)', fontsize=12, pad=12)
story.append(fig_to_image(fig))
story.append(spacer(3))

story.append(data_table(
    ['플랫폼', '비디', '상위그룹 평균', '격차', '진단'],
    [
        ['Gemini', '34', '85', '<font color="#E74C3C"><b>-51</b></font>', '최대 약점 · 최우선 공략'],
        ['Perplexity', '31', '49', '<font color="#E74C3C">-18</font>', '두 번째 구멍'],
        ['ChatGPT', '37', '49', '<font color="#E74C3C">-12</font>', '보강 필요'],
        ['Claude', '57', '39', '<font color="#27AE60"><b>+18</b></font>', '유일한 초과 강점 · 유지'],
        ['Grok', '4', '0', '<font color="#27AE60">+4</font>', 'Live Search 픽스로 회복 예정'],
    ],
    col_widths=[30*mm, 22*mm, 32*mm, 24*mm, 62*mm],
    highlight_rows=[0], highlight_bg=colors.HexColor('#FDECEA')))
story.append(spacer(4))
story.append(colored_box(
    '<b>핵심 발견:</b> 상위권 병원들은 거의 전원 Gemini 80~100점입니다 (서울365 100, 청라 100, 성복 100, '
    '바른플란트 100, 강북감동 100, 미소 100...). 비디는 34점. <b>Gemini 하나가 전체 격차의 절반 이상</b>을 차지합니다.',
    colors.HexColor('#FDECEA'), C_TEXT, 'NanumSquare', 10))
story.append(PageBreak())

# ═══════════════ 2. 프롬프트 분석 ═══════════════
story.append(Paragraph('2. 질문 단위 정밀 진단 — 어떤 질문에서 지고 있는가', S_H1))
story.append(hr())
story.append(Paragraph(
    '최근 7일간 101개 질문(프롬프트)에 대한 AI 응답을 분석한 결과, 명확한 패턴이 드러났습니다. '
    '<b>"브랜드를 아는 사람의 질문에는 만점, 브랜드를 모르는 사람의 질문에는 전멸"</b> — '
    '즉, 인지 단계의 신규 환자가 AI에게 물어볼 때 서울비디치과가 후보에 오르지 못하고 있습니다.', S_BODY_J))
story.append(spacer(4))

# 도넛 차트: 프롬프트 분포
fig, axes = plt.subplots(1, 2, figsize=(10, 3.8))
sizes = [6, 44, 45, 6]
labels = ['완전 미언급 (0%)\n6개', '약함 (<30%)\n44개', '보통\n45개', '강함 (70%+)\n6개']
cols = ['#E74C3C', '#F39C12', '#CBD5E1', '#27AE60']
axes[0].pie(sizes, labels=labels, colors=cols, autopct='', startangle=90,
            wedgeprops=dict(width=0.42, edgecolor='white'), textprops={'fontsize': 9.5})
axes[0].set_title('101개 질문 언급률 분포', fontsize=12)
axes[0].text(0, 0, '절반이\n약점 구간', ha='center', va='center', fontsize=11, fontweight='bold', color='#E74C3C')

cats = ['가격/비용', '위치/근처', '증상/치료', '브랜드']
weak_counts = [28, 12, 10, 0]
axes[1].barh(cats, weak_counts, color=['#E74C3C', '#F39C12', '#F39C12', '#27AE60'], height=0.55)
for i, v in enumerate(weak_counts):
    axes[1].text(v + 0.4, i, f'{v}개', va='center', fontsize=10, fontweight='bold')
axes[1].set_title('약점 질문(50개)의 인텐트 분류', fontsize=12)
axes[1].set_xlim(0, 33)
axes[1].spines[['top', 'right']].set_visible(False)
axes[1].grid(axis='x', alpha=0.25)
fig.tight_layout()
story.append(fig_to_image(fig))
story.append(spacer(3))

story.append(Paragraph('2-1. 완전 미언급(0%) 질문 — 전부 가격/비용·위치 인텐트', S_H2))
story.append(data_table(
    ['질문', '인텐트', '언급률'],
    [
        ['천안 레진 치료 가격', '가격', '0%'],
        ['천안시 심미보철 라미네이트 가격', '가격', '0%'],
        ['천안 치과 충치치료 비용', '가격', '0%'],
        ['천안 스케일링 비용', '가격', '0%'],
        ['잇몸에서 피나는데 천안 치과', '증상', '0%'],
        ['충남대병원 근처 치과 추천', '위치', '0%'],
    ],
    col_widths=[95*mm, 40*mm, 35*mm], header_bg=C_RED))
story.append(spacer(4))

story.append(Paragraph('2-2. 약함(<30%) 대표 질문 44개 중 일부', S_H2))
story.append(Paragraph(
    '· 임플란트 가격/비용 비교 계열 다수  · 사랑니 발치 비용  · 틀니 관련  · 교정 월납부금<br/>'
    '· 천안역 근처 치과  · 응급치과  — 대부분 <b>가격·비용·위치성 질문</b>에 집중', S_BULLET))
story.append(spacer(4))

story.append(Paragraph('2-3. 강함(70%+) 질문 — 브랜드가 등장하면 만점', S_H2))
story.append(data_table(
    ['질문', '점수', '해석'],
    [
        ['천안 서울비디치과 후기', '<font color="#27AE60"><b>25/25</b></font>', '브랜드 인지 질문 만점'],
        ['천안 서울비디치과 vs 다른 치과 비교', '<font color="#27AE60"><b>25/25</b></font>', '비교 우위 콘텐츠 작동 중'],
        ['천안 소아치과 추천', '20/25', '카테고리 강점'],
        ['천안 불당동 임플란트', '18/25', '핵심 상권 방어 중'],
    ],
    col_widths=[85*mm, 30*mm, 55*mm], header_bg=C_GREEN))
story.append(spacer(4))
story.append(colored_box(
    '<b>페이션트 퍼널 관점:</b> 소개·재방문 단계(브랜드 질문)는 완벽하게 방어 중이나, '
    '<b>인지 단계(non-branded 질문)의 퍼널 입구가 막혀 있습니다.</b> 상담 전환율이 아무리 좋아도 '
    '대기실에 못 들어오는 환자는 전환할 수 없습니다.',
    C_PRIMARY, C_WHITE, 'NanumSquare', 10))
story.append(PageBreak())

# ═══════════════ 3. 개선 전략 ═══════════════
story.append(Paragraph('3. 개선 전략 — 어디를 때려야 점수가 오르는가', S_H1))
story.append(hr())
story.append(Paragraph(
    '진단 결과를 종합하면 처방은 명확합니다. <b>① Gemini 채널 공략 ② 가격·비용 콘텐츠 구축 '
    '③ 후기·리뷰 신호 강화</b> — 이 세 가지가 전체 격차의 80% 이상을 설명합니다. '
    '우선순위 순서대로 정리합니다.', S_BODY_J))
story.append(spacer(4))

story.append(Paragraph('3-1. [최우선] Gemini 공략 — 격차 -51점의 정체', S_H2))
story.append(Paragraph(
    'Gemini는 답변을 생성할 때 <b>Google 검색 그라운딩(grounding)</b>을 사용합니다. '
    '즉, Gemini 점수는 사실상 <b>구글 검색 생태계에서의 존재감</b>을 반영합니다. '
    '상위권 병원들이 Gemini에서 80~100점을 받는 이유는 아래 자산이 정비되어 있기 때문입니다.', S_BODY_J))
story.append(spacer(2))
story.append(data_table(
    ['공략 항목', '해야 할 일', '기대 효과'],
    [
        ['구글 비즈니스 프로필(GBP)', '진료과목·시술별 서비스 항목 전부 등록, 사진 30장+, 주간 소식 게시, Q&A 시딩', '★★★'],
        ['구글 리뷰', '리뷰 200개+ 목표, 시술명 포함 리뷰 유도("임플란트", "인비절라인" 키워드)', '★★★'],
        ['홈페이지 구조화 데이터', 'Dentist/LocalBusiness/FAQPage 스키마 마크업 적용', '★★☆'],
        ['구글 지도 일관성(NAP)', '이름·주소·전화 표기를 모든 채널에서 100% 통일', '★★☆'],
        ['유튜브(구글 자산)', '시술 설명 영상에 지역+시술 키워드 제목 최적화', '★☆☆'],
    ],
    col_widths=[42*mm, 96*mm, 32*mm]))
story.append(spacer(3))
story.append(colored_box(
    '<b>왜 여기부터인가:</b> Gemini 34→80점만 회복해도 종합점수는 63점에서 <b>약 72~75점 구간(추정 5~7위권)</b>으로 '
    '점프합니다. 단일 채널 개선으로 얻을 수 있는 최대 레버리지입니다.',
    colors.HexColor('#E8F0FE'), C_TEXT, 'NanumSquare', 10))
story.append(spacer(5))

story.append(Paragraph('3-2. [2순위] 가격·비용 콘텐츠 — 전멸 구간 복구', S_H2))
story.append(Paragraph(
    '가격 질문 28개가 약점 구간에 몰려 있습니다. AI는 "가격을 물어보는 사용자"에게 '
    '<b>실제 비용 정보를 담은 페이지를 보유한 병원</b>을 인용합니다. 비급여 수가는 이미 '
    '심평원 공개 대상이므로, 숨길 이유가 없다면 먼저 공개하는 쪽이 AI의 선택을 받습니다.', S_BODY_J))
story.append(spacer(2))
story.append(data_table(
    ['액션', '구체 내용'],
    [
        ['비급여 수가 안내 페이지', '임플란트(국산/수입/뼈이식), 교정(인비절라인/부분), 라미네이트, 미백, 사랑니 발치 등 항목별 가격 범위 명시'],
        ['가격 FAQ 콘텐츠', '"천안 임플란트 비용은?", "뼈이식 포함하면?", "보험 적용 65세 이상은?" — 질문형 제목 + 두괄식 답변'],
        ['블로그 가격 시리즈', '월 2회, "천안 ○○ 가격, 서울비디치과가 정리해드립니다" 포맷으로 상위 미언급 질문 커버'],
        ['건강보험 적용 안내', '틀니·임플란트 급여 기준을 표로 정리 — AI가 인용하기 좋은 구조화된 표'],
    ],
    col_widths=[45*mm, 125*mm]))
story.append(spacer(5))

story.append(Paragraph('3-3. [3순위] 후기·리뷰 신호 강화 (격차 -77.7pp)', S_H2))
story.append(Paragraph(
    '"후기 좋은 치과" 계열 질문에서 상위그룹 대비 언급률이 크게 낮습니다. AI가 참조하는 후기 소스는 '
    '구글 리뷰 > 네이버 리뷰·블로그 > 맘카페/커뮤니티 순으로 관찰됩니다.', S_BODY_J))
story.append(Paragraph(
    '· 치료 완료 환자 대상 구글 리뷰 요청 동선 신설 (QR + 데스크 스크립트)<br/>'
    '· 리뷰에 시술명이 들어가도록 유도 문구 설계 ("어떤 치료 받으셨는지 함께 남겨주시면...")<br/>'
    '· 네이버 영수증 리뷰 병행 — Perplexity·ChatGPT가 네이버 소스를 인용하는 빈도 높음<br/>'
    '· 기존 내원 환자 후기 콘텐츠를 홈페이지 "치료 사례" 섹션으로 구조화', S_BULLET))
story.append(spacer(5))

story.append(Paragraph('3-4. [유지] Claude 강점(+18) 지키기', S_H2))
story.append(Paragraph(
    'Claude에서는 이미 상위그룹을 앞서고 있습니다. 현재의 홈페이지 콘텐츠 품질과 브랜드 서사가 '
    '작동 중이라는 신호이므로, 새 콘텐츠도 같은 톤(전문성 + 구체적 근거)을 유지하면 됩니다.', S_BODY_J))
story.append(PageBreak())

# ═══════════════ 4. 실행 로드맵 ═══════════════
story.append(Paragraph('4. 실행 로드맵 — 이미 한 것과 앞으로 할 것', S_H1))
story.append(hr())

story.append(Paragraph('4-1. 이미 실행 완료된 조치 (2026-07-02)', S_H2))
story.append(data_table(
    ['조치', '내용', '상태'],
    [
        ['측정 프롬프트 200개 확장', '101→200개. 약점 구간(가격 32·추천 30·증상 26·비교 25·후기 22...) 집중 배치 — 개선 효과를 정밀 추적할 계기판 완성', '<font color="#27AE60"><b>완료</b></font>'],
        ['Grok 측정 정상화', 'Live Search 활성화 — 기존 4점은 측정 오류 포함, 실제 점수 회복 예정', '<font color="#27AE60"><b>완료</b></font>'],
        ['미언급 병원 점수 보정', '언급 안 된 병원에 공짜점수 주던 로직 제거 — 순위 신뢰도 향상', '<font color="#27AE60"><b>완료</b></font>'],
    ],
    col_widths=[42*mm, 106*mm, 22*mm], header_bg=C_GREEN))
story.append(spacer(5))

story.append(Paragraph('4-2. 향후 8주 로드맵', S_H2))
story.append(data_table(
    ['주차', '실행 항목', '담당', 'KPI'],
    [
        ['1~2주', 'GBP 전면 정비 (서비스·사진·게시물·Q&A) + NAP 통일', '마케팅', 'GBP 완성도 100%'],
        ['1~2주', '비급여 수가 안내 페이지 제작 + FAQPage 스키마', '마케팅/개발', '가격 페이지 라이브'],
        ['3~4주', '구글 리뷰 캠페인 시작 (데스크 동선 + QR)', '데스크 전체', '주 15개+ 신규 리뷰'],
        ['3~4주', '가격 FAQ 블로그 1차 6편 (완전 미언급 질문 6개 정조준)', '마케팅', '6편 발행'],
        ['5~6주', '홈페이지 구조화 데이터(Dentist/LocalBusiness) 적용', '개발', '리치결과 검증 통과'],
        ['5~8주', '후기 콘텐츠 구조화 + 네이버 리뷰 병행', '마케팅', '치료사례 20건'],
        ['8주차', 'Patient Signal 재측정 리뷰 — 200개 프롬프트 기준 변화 확인', '원장', 'Gemini 60+ / 종합 70+'],
    ],
    col_widths=[20*mm, 88*mm, 26*mm, 36*mm]))
story.append(spacer(5))

story.append(Paragraph('4-3. 목표 시나리오', S_H2))
# 목표 시나리오 차트
fig, ax = plt.subplots(figsize=(9, 3.6))
stages = ['현재\n(7월)', '8주 후\n(9월)', '16주 후\n(11월)']
overall = [63, 72, 80]
gemini = [34, 60, 85]
x = np.arange(len(stages))
ax.plot(x, overall, 'o-', color='#6C63FF', linewidth=2.5, markersize=9, label='종합점수', zorder=3)
ax.plot(x, gemini, 's--', color='#4285F4', linewidth=2, markersize=8, label='Gemini', zorder=3)
for i, (o, g) in enumerate(zip(overall, gemini)):
    ax.annotate(f'{o}', (i, o), textcoords='offset points', xytext=(0, 12), ha='center',
                fontsize=12, fontweight='bold', color='#6C63FF')
    ax.annotate(f'{g}', (i, g), textcoords='offset points', xytext=(0, -18), ha='center',
                fontsize=11, color='#4285F4')
ax.set_xticks(x)
ax.set_xticklabels(stages, fontsize=11)
ax.set_ylim(20, 100)
ax.legend(fontsize=10, loc='upper left')
ax.grid(alpha=0.25, zorder=0)
ax.spines[['top', 'right']].set_visible(False)
ax.set_title('목표: 16주 내 종합 80점 = 추정 Top 5 진입', fontsize=12, pad=10)
story.append(fig_to_image(fig))
story.append(spacer(4))

story.append(colored_box(
    '<font name="NanumSquareEB" size="12">한 줄 결론</font><br/><br/>'
    '서울비디치과는 <b>아는 사람에게는 이미 이긴 병원</b>입니다. 이제 필요한 것은 '
    '<b>모르는 사람이 AI에게 물었을 때 후보에 오르는 것</b> — 그 열쇠는 Gemini(구글 생태계), '
    '가격 투명성, 그리고 리뷰 신호입니다. 퍼널의 입구를 여는 순간, 이미 검증된 전환 시스템이 나머지를 해냅니다.',
    C_PRIMARY, pad=16))
story.append(spacer(8))
story.append(Paragraph('본 보고서는 Patient Signal 프로덕션 DB의 실측 데이터(6개 AI 플랫폼 × 101개 프롬프트 × 최근 7~30일)를 기반으로 작성되었습니다.', S_SMALL))
story.append(Paragraph(f'© {datetime.now().year} Patient Signal · Seoul VD Dental Clinic', S_SMALL))

# ═══════════════ 빌드 ═══════════════
OUTPUT = 'vd_improvement_report.pdf'
doc = SimpleDocTemplate(OUTPUT, pagesize=A4,
                        topMargin=18*mm, bottomMargin=16*mm,
                        leftMargin=20*mm, rightMargin=20*mm,
                        title='서울비디치과 AI 가시성 진단 & 개선 전략 보고서',
                        author='Patient Signal')

def footer(canvas, doc_):
    canvas.saveState()
    canvas.setFont('NanumSquareL', 7.5)
    canvas.setFillColor(colors.HexColor('#9AA0A6'))
    canvas.drawString(20*mm, 10*mm, 'Patient Signal — AI 가시성 진단 보고서')
    canvas.drawRightString(190*mm, 10*mm, f'{doc_.page}')
    canvas.restoreState()

doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(f'✅ PDF 생성 완료: {OUTPUT}')
