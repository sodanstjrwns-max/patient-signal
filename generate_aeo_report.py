#!/usr/bin/env python3
"""
AI 플랫폼별 공략 전략 리포트 - Patient Signal
데이터 기반 AEO(AI Engine Optimization) 가이드
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether, Image
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Circle
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics import renderPDF
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import os
import io
from datetime import datetime

# ── 폰트 등록 ──
FONT_DIR = '/usr/share/fonts/truetype/nanum/'
pdfmetrics.registerFont(TTFont('NanumSquare', FONT_DIR + 'NanumSquareR.ttf'))
pdfmetrics.registerFont(TTFont('NanumSquareB', FONT_DIR + 'NanumSquareB.ttf'))
pdfmetrics.registerFont(TTFont('NanumSquareEB', FONT_DIR + 'NanumSquareEB.ttf'))
pdfmetrics.registerFont(TTFont('NanumSquareL', FONT_DIR + 'NanumSquareL.ttf'))

# ── 컬러 팔레트 ──
C_PRIMARY = colors.HexColor('#1a1a2e')
C_ACCENT = colors.HexColor('#6C63FF')
C_ACCENT2 = colors.HexColor('#00d2ff')
C_GPT = colors.HexColor('#10A37F')
C_PERPLEXITY = colors.HexColor('#20808D')
C_GEMINI = colors.HexColor('#4285F4')
C_CLAUDE = colors.HexColor('#D97706')
C_BG_LIGHT = colors.HexColor('#F8F9FA')
C_BG_DARK = colors.HexColor('#1a1a2e')
C_TEXT = colors.HexColor('#2D3436')
C_TEXT_LIGHT = colors.HexColor('#636E72')
C_RED = colors.HexColor('#E74C3C')
C_GREEN = colors.HexColor('#27AE60')
C_ORANGE = colors.HexColor('#F39C12')
C_WHITE = colors.white

# ── 스타일 ──
styles = getSampleStyleSheet()

def make_style(name, fontName='NanumSquare', fontSize=10, textColor=C_TEXT,
               alignment=TA_LEFT, spaceAfter=4, spaceBefore=0, leading=None,
               leftIndent=0, bulletIndent=0):
    if leading is None:
        leading = fontSize * 1.5
    return ParagraphStyle(
        name, fontName=fontName, fontSize=fontSize, textColor=textColor,
        alignment=alignment, spaceAfter=spaceAfter, spaceBefore=spaceBefore,
        leading=leading, leftIndent=leftIndent, bulletIndent=bulletIndent
    )

S_TITLE = make_style('S_TITLE', 'NanumSquareEB', 28, C_PRIMARY, TA_CENTER, 8, leading=36)
S_SUBTITLE = make_style('S_SUBTITLE', 'NanumSquare', 14, C_TEXT_LIGHT, TA_CENTER, 20, leading=20)
S_H1 = make_style('S_H1', 'NanumSquareEB', 20, C_PRIMARY, spaceAfter=12, spaceBefore=16, leading=28)
S_H2 = make_style('S_H2', 'NanumSquareB', 15, C_ACCENT, spaceAfter=8, spaceBefore=12, leading=22)
S_H3 = make_style('S_H3', 'NanumSquareB', 12, C_PRIMARY, spaceAfter=6, spaceBefore=8, leading=18)
S_BODY = make_style('S_BODY', 'NanumSquare', 10, C_TEXT, spaceAfter=4, leading=16)
S_BODY_J = make_style('S_BODY_J', 'NanumSquare', 10, C_TEXT, TA_JUSTIFY, 4, leading=16)
S_SMALL = make_style('S_SMALL', 'NanumSquareL', 8, C_TEXT_LIGHT, spaceAfter=2, leading=12)
S_QUOTE = make_style('S_QUOTE', 'NanumSquareB', 11, C_ACCENT, TA_LEFT, 8, 4, leftIndent=20, leading=18)
S_FORMULA = make_style('S_FORMULA', 'NanumSquareB', 11, C_PRIMARY, TA_CENTER, 10, 6, leading=18)
S_BULLET = make_style('S_BULLET', 'NanumSquare', 10, C_TEXT, spaceAfter=3, leading=16, leftIndent=20, bulletIndent=10)
S_CENTER = make_style('S_CENTER', 'NanumSquare', 10, C_TEXT, TA_CENTER, 4, leading=16)
S_FOOTER = make_style('S_FOOTER', 'NanumSquareL', 7, C_TEXT_LIGHT, TA_CENTER, leading=10)

def hr(width='100%', thickness=1, color=C_ACCENT):
    return HRFlowable(width=width, thickness=thickness, color=color, spaceAfter=8, spaceBefore=8)

def spacer(h=6):
    return Spacer(1, h*mm)

def colored_box_table(text, bg_color, text_color=C_WHITE, font='NanumSquareB', size=11):
    """Create a colored box with text"""
    style = ParagraphStyle('box', fontName=font, fontSize=size, textColor=text_color,
                           alignment=TA_CENTER, leading=size*1.4)
    t = Table([[Paragraph(text, style)]], colWidths=['100%'])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_color),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 15),
        ('RIGHTPADDING', (0,0), (-1,-1), 15),
        ('ROUNDEDCORNERS', [8,8,8,8]),
    ]))
    return t

def stat_card(label, value, sub='', color=C_ACCENT):
    """Create a stat card"""
    data = [[
        Paragraph(f'<font name="NanumSquareEB" size="22" color="{color.hexval()}">{value}</font>', 
                  make_style('sv', alignment=TA_CENTER)),
    ], [
        Paragraph(f'<font name="NanumSquare" size="9" color="#636E72">{label}</font>',
                  make_style('sl', alignment=TA_CENTER)),
    ]]
    if sub:
        data.append([Paragraph(f'<font name="NanumSquareL" size="7" color="#636E72">{sub}</font>',
                               make_style('ss', alignment=TA_CENTER))])
    t = Table(data, colWidths=[120])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), C_BG_LIGHT),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (0,0), 12),
        ('BOTTOMPADDING', (-1,-1), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('ROUNDEDCORNERS', [6,6,6,6]),
    ]))
    return t

def make_data_table(headers, rows, col_widths=None, header_bg=C_PRIMARY):
    """Create a styled data table"""
    header_style = ParagraphStyle('th', fontName='NanumSquareB', fontSize=9, 
                                   textColor=C_WHITE, alignment=TA_CENTER, leading=13)
    cell_style = ParagraphStyle('td', fontName='NanumSquare', fontSize=9,
                                 textColor=C_TEXT, alignment=TA_CENTER, leading=13)
    cell_left = ParagraphStyle('tdl', fontName='NanumSquare', fontSize=9,
                                textColor=C_TEXT, alignment=TA_LEFT, leading=13)
    
    data = [[Paragraph(h, header_style) for h in headers]]
    for row in rows:
        cells = []
        for i, cell in enumerate(row):
            st = cell_left if i == 0 else cell_style
            cells.append(Paragraph(str(cell), st))
        data.append(cells)
    
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0,0), (-1,0), header_bg),
        ('TEXTCOLOR', (0,0), (-1,0), C_WHITE),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('ALIGN', (0,1), (0,-1), 'LEFT'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#DEE2E6')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('ROUNDEDCORNERS', [4,4,4,4]),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0,i), (-1,i), colors.HexColor('#F8F9FA')))
    t.setStyle(TableStyle(style_cmds))
    return t

def create_bar_chart_image(labels, values, bar_colors, title='', width=460, height=180):
    """Create a bar chart using matplotlib and return as Image"""
    fig, ax = plt.subplots(figsize=(width/72, height/72), dpi=72)
    
    plt.rcParams['font.family'] = 'NanumSquare'
    
    bars = ax.bar(range(len(labels)), values, color=bar_colors, width=0.6, edgecolor='white', linewidth=0.5)
    
    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels, fontsize=9, fontfamily='NanumSquare')
    ax.set_ylabel('')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#DEE2E6')
    ax.spines['bottom'].set_color('#DEE2E6')
    ax.tick_params(colors='#636E72', labelsize=8)
    ax.yaxis.set_tick_params(labelsize=8)
    
    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width()/2., bar.get_height() + 0.5,
                f'{val}%' if isinstance(val, (int, float)) else str(val),
                ha='center', va='bottom', fontsize=9, fontweight='bold', fontfamily='NanumSquare')
    
    if title:
        ax.set_title(title, fontsize=11, fontweight='bold', fontfamily='NanumSquare', pad=10)
    
    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    buf.seek(0)
    
    img_path = f'/tmp/chart_{title.replace(" ","_")}.png'
    with open(img_path, 'wb') as f:
        f.write(buf.read())
    return Image(img_path, width=width*0.75, height=height*0.75)

def page_header_footer(canvas, doc):
    """Add header and footer to each page"""
    canvas.saveState()
    
    # Header line
    canvas.setStrokeColor(C_ACCENT)
    canvas.setLineWidth(2)
    canvas.line(30, A4[1]-30, A4[0]-30, A4[1]-30)
    
    # Header text
    canvas.setFont('NanumSquareL', 7)
    canvas.setFillColor(C_TEXT_LIGHT)
    canvas.drawString(35, A4[1]-26, 'Patient Signal | AI 플랫폼별 공략 전략 리포트')
    canvas.drawRightString(A4[0]-35, A4[1]-26, '2026.04.14')
    
    # Footer
    canvas.setStrokeColor(colors.HexColor('#DEE2E6'))
    canvas.setLineWidth(0.5)
    canvas.line(30, 35, A4[0]-30, 35)
    
    canvas.setFont('NanumSquareL', 7)
    canvas.setFillColor(C_TEXT_LIGHT)
    canvas.drawString(35, 22, 'https://patientsignal.co.kr')
    canvas.drawCentredString(A4[0]/2, 22, f'- {doc.page} -')
    canvas.drawRightString(A4[0]-35, 22, 'Confidential')
    
    canvas.restoreState()

def build_report():
    output_path = '/home/user/webapp/AI_플랫폼별_공략전략_Patient_Signal.pdf'
    
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        topMargin=40,
        bottomMargin=45,
        leftMargin=35,
        rightMargin=35,
        title='AI 플랫폼별 공략 전략 - Patient Signal',
        author='Patient Signal'
    )
    
    story = []
    W = A4[0] - 70  # usable width
    
    # ════════════════════════════════════════
    # COVER PAGE
    # ════════════════════════════════════════
    story.append(spacer(35))
    
    # Logo area / Brand
    story.append(colored_box_table(
        'PATIENT SIGNAL', C_PRIMARY, C_WHITE, 'NanumSquareEB', 14
    ))
    story.append(spacer(20))
    
    story.append(Paragraph(
        'AI 플랫폼별 공략 전략<br/>데이터 기반 AEO 가이드',
        make_style('cover_title', 'NanumSquareEB', 32, C_PRIMARY, TA_CENTER, 12, leading=44)
    ))
    story.append(spacer(6))
    story.append(Paragraph(
        'ChatGPT · Perplexity · Gemini · Claude',
        make_style('cover_sub', 'NanumSquare', 16, C_ACCENT, TA_CENTER, 8, leading=22)
    ))
    story.append(spacer(10))
    story.append(hr('60%', 2, C_ACCENT))
    story.append(spacer(6))
    
    story.append(Paragraph(
        '21,369개 AI 응답 데이터 분석 · 76개 병원 실증 데이터',
        make_style('cover_data', 'NanumSquareB', 12, C_TEXT, TA_CENTER, 6, leading=18)
    ))
    story.append(spacer(4))
    story.append(Paragraph(
        '세계 최초 의료기관 대상 AI 검색엔진 최적화(AEO) 실증 리포트',
        make_style('cover_desc', 'NanumSquare', 11, C_TEXT_LIGHT, TA_CENTER, 20, leading=16)
    ))
    
    # Stats cards on cover
    cover_stats = Table([
        [stat_card('분석 AI 응답', '21,369건', '4개 플랫폼'),
         stat_card('모니터링 병원', '76개', '실시간 추적'),
         stat_card('일일 점수 데이터', '1,070일', '일별 누적'),
         stat_card('유료결제 회원', '0명', '아직 없음')]
    ], colWidths=[W/4]*4)
    cover_stats.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(cover_stats)
    
    story.append(spacer(30))
    story.append(Paragraph('2026년 4월 14일', make_style('date', 'NanumSquare', 11, C_TEXT_LIGHT, TA_CENTER)))
    story.append(spacer(3))
    story.append(Paragraph(
        '<font color="#6C63FF">https://patientsignal.co.kr</font>',
        make_style('url', 'NanumSquareB', 12, C_ACCENT, TA_CENTER)
    ))
    
    story.append(PageBreak())
    
    # ════════════════════════════════════════
    # TABLE OF CONTENTS
    # ════════════════════════════════════════
    story.append(Paragraph('목차', S_H1))
    story.append(hr())
    
    toc_items = [
        ('01', '전체 요약 비교', '4개 AI 플랫폼 핵심 지표 비교'),
        ('02', 'ChatGPT 공략법', '브랜드 스토리텔링 + 기술 디테일 전략'),
        ('03', 'Perplexity 공략법', '웹 출처 + 네이버 평점 최적화 전략'),
        ('04', 'Gemini 공략법', '키워드 다양성 + 지역 커버리지 전략'),
        ('05', 'Claude 공략법', '권위 + 웹 신뢰도 전략'),
        ('06', '질문 의도(Intent)별 전략', '5가지 질문 유형별 최적 대응법'),
        ('07', 'TOP10 vs BOTTOM10 분석', '성공 병원의 공통점과 실패 요인'),
        ('08', '즉시 실행 액션 플랜', '우선순위별 실행 가이드'),
    ]
    
    for num, title, desc in toc_items:
        t = Table([
            [Paragraph(f'<font name="NanumSquareEB" size="14" color="#6C63FF">{num}</font>',
                       make_style('tn', alignment=TA_CENTER)),
             Paragraph(f'<font name="NanumSquareB" size="11">{title}</font><br/>'
                       f'<font name="NanumSquareL" size="8" color="#636E72">{desc}</font>',
                       make_style('td', leading=16))]
        ], colWidths=[40, W-50])
        t.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#DEE2E6')),
        ]))
        story.append(t)
    
    story.append(PageBreak())
    
    # ════════════════════════════════════════
    # SECTION 1: OVERVIEW
    # ════════════════════════════════════════
    story.append(Paragraph('01  전체 요약 비교', S_H1))
    story.append(hr())
    story.append(spacer(4))
    
    story.append(Paragraph(
        '76개 병원에서 수집한 21,369개 AI 응답을 분석한 결과, 4개 AI 플랫폼은 각각 '
        '매우 다른 추천 패턴을 보여줍니다. 동일한 병원이라도 플랫폼에 따라 멘션 여부와 '
        '추천 깊이가 완전히 달라집니다.',
        S_BODY_J
    ))
    story.append(spacer(6))
    
    # Main comparison table
    story.append(Paragraph('핵심 지표 비교표', S_H3))
    story.append(make_data_table(
        ['지표', 'ChatGPT', 'Perplexity', 'Gemini', 'Claude'],
        [
            ['멘션율', '27.9%', '14.7%', '35.4% ★', '25.3%'],
            ['1위 추천 비율', '61.2%', '70.2% ★', '33.3%', '60.7%'],
            ['R3(단독추천)', '259건', '269건 ★', '38건', '93건'],
            ['Sentiment V2', '0.97 ★', '0.79', '0.94', '0.94'],
            ['멘션시 응답길이', '1,130자 ★', '511자', '740자', '591자'],
            ['웹사이트有 멘션%', '53.6%', '49.9%', '46.7%', '66.9% ★'],
            ['네이버有 멘션%', '52.0%', '48.6%', '44.2%', '66.1% ★'],
        ],
        col_widths=[90, 90, 90, 90, 90]
    ))
    story.append(spacer(4))
    story.append(Paragraph('★ = 해당 지표에서 1위', S_SMALL))
    
    story.append(spacer(8))
    
    # Bar chart - mention rates
    chart_img = create_bar_chart_image(
        ['ChatGPT', 'Perplexity', 'Gemini', 'Claude'],
        [27.9, 14.7, 35.4, 25.3],
        ['#10A37F', '#20808D', '#4285F4', '#D97706'],
        title='플랫폼별 멘션율 비교'
    )
    story.append(chart_img)
    
    story.append(spacer(8))
    
    # Key insight box
    story.append(colored_box_table(
        '핵심 인사이트: Gemini는 가장 많이 추천하지만 깊이가 얕고, Perplexity는 가장 적게 '
        '추천하지만 한번 하면 1위로 추천합니다. 플랫폼마다 전혀 다른 전략이 필요합니다.',
        C_ACCENT, C_WHITE, 'NanumSquare', 10
    ))
    
    story.append(PageBreak())
    
    # ════════════════════════════════════════
    # SECTION 2: CHATGPT
    # ════════════════════════════════════════
    story.append(Paragraph('02  ChatGPT 공략법', S_H1))
    story.append(Paragraph('브랜드 스토리텔링 + 기술 디테일 전략', 
                           make_style('s2sub', 'NanumSquare', 12, C_GPT, spaceAfter=8)))
    story.append(hr('100%', 2, C_GPT))
    story.append(spacer(4))
    
    # Stats row
    gpt_stats = Table([
        [stat_card('멘션율', '27.9%', '1,451건 / 5,210건', C_GPT),
         stat_card('R3 단독추천', '259건', '4개 플랫폼 중 최다', C_GPT),
         stat_card('응답 길이', '1,130자', '멘션시 평균', C_GPT),
         stat_card('Sentiment', '+0.97', '가장 긍정적', C_GPT)]
    ], colWidths=[W/4]*4)
    gpt_stats.setStyle(TableStyle([('ALIGN',(0,0),(-1,-1),'CENTER'), ('VALIGN',(0,0),(-1,-1),'TOP')]))
    story.append(gpt_stats)
    story.append(spacer(8))
    
    story.append(Paragraph('ChatGPT의 특성', S_H2))
    story.append(Paragraph(
        'ChatGPT는 가장 긴 응답(1,130자)을 생성하며, 한번 멘션하면 매우 긍정적으로 설명합니다. '
        'R3(단독추천) 259건으로 4개 플랫폼 중 가장 많이 "이 병원이 좋습니다"라고 단독 추천합니다.',
        S_BODY_J
    ))
    story.append(spacer(4))
    
    story.append(Paragraph('멘션 트리거 키워드 분석', S_H3))
    story.append(Paragraph(
        '멘션된 응답 vs 멘션되지 않은 응답에서 출현하는 키워드 차이를 분석하면, '
        'ChatGPT가 어떤 키워드에 반응하는지 알 수 있습니다.',
        S_BODY_J
    ))
    story.append(spacer(4))
    
    story.append(make_data_table(
        ['키워드', '멘션 응답 출현율', '미멘션 출현율', '차이', '의미'],
        [
            ['임플란트', '62.2%', '41.8%', '+20.4%', '핵심 트리거'],
            ['디지털', '24.6%', '9.4%', '+15.2%', '기술 차별점'],
            ['장비', '35.6%', '26.2%', '+9.4%', '시설 강점'],
            ['교정', '37.4%', '29.4%', '+8.0%', '진료과목 노출'],
            ['전문의', '55.3%', '48.1%', '+7.2%', '권위 신호'],
        ],
        col_widths=[70, 90, 80, 60, 80]
    ))
    
    story.append(spacer(8))
    story.append(Paragraph('공략 전략', S_H3))
    
    gpt_strategies = [
        '<b>1. 진료과목을 구체적으로 명시하는 콘텐츠 제작</b> — "임플란트" 키워드만으로 멘션율 +20% 차이. 시술별 경험수, 성공률을 정량적으로 기재하세요.',
        '<b>2. 디지털 장비/기술 강조</b> — "디지털 가이드 임플란트", "3D CT", "네비게이션 수술" 등 기술 키워드가 멘션 확률 +15% 증가시킵니다.',
        '<b>3. INFORMATION(정보탐색) 의도 질문에 집중</b> — ChatGPT 멘션의 81%가 정보탐색 질문에서 발생. "OO 지역 임플란트 잘하는 곳"류의 질문 대비 콘텐츠를 우선 확보하세요.',
        '<b>4. 비용/후기보다 전문성 중심</b> — 비용, 후기는 오히려 미멘션 응답에서 더 많이 등장합니다. 가격이 아닌 전문성으로 승부하세요.',
    ]
    for s in gpt_strategies:
        story.append(Paragraph(f'• {s}', S_BULLET))
    
    story.append(spacer(6))
    story.append(colored_box_table(
        'ChatGPT 공식: 전문의 자격 + 디지털 장비 + 시술별 경험수 = 단독추천(R3)',
        C_GPT, C_WHITE, 'NanumSquareEB', 12
    ))
    
    story.append(PageBreak())
    
    # ════════════════════════════════════════
    # SECTION 3: PERPLEXITY
    # ════════════════════════════════════════
    story.append(Paragraph('03  Perplexity 공략법', S_H1))
    story.append(Paragraph('웹 출처 + 네이버 평점 최적화 전략',
                           make_style('s3sub', 'NanumSquare', 12, C_PERPLEXITY, spaceAfter=8)))
    story.append(hr('100%', 2, C_PERPLEXITY))
    story.append(spacer(4))
    
    ppl_stats = Table([
        [stat_card('멘션율', '14.7%', '최저 — 하지만...', C_PERPLEXITY),
         stat_card('1위 추천율', '70.2%', '멘션하면 1위!', C_PERPLEXITY),
         stat_card('R3 단독추천', '269건', 'ChatGPT와 동률', C_PERPLEXITY),
         stat_card('응답 길이', '511자', '간결하게 추천', C_PERPLEXITY)]
    ], colWidths=[W/4]*4)
    ppl_stats.setStyle(TableStyle([('ALIGN',(0,0),(-1,-1),'CENTER'), ('VALIGN',(0,0),(-1,-1),'TOP')]))
    story.append(ppl_stats)
    story.append(spacer(8))
    
    story.append(Paragraph('Perplexity의 특성', S_H2))
    story.append(Paragraph(
        'Perplexity는 웹 검색 기반 AI입니다. 멘션율 14.7%로 가장 낮지만, 한번 멘션하면 '
        '<b>70.2%가 1위로 추천</b>합니다. "아는 건 확실하게 추천한다"는 패턴입니다. '
        '또한 <b>미멘션 시 응답 길이(651자) > 멘션 시(511자)</b>로, 추천할 때는 간결하고 확신있게 말합니다.',
        S_BODY_J
    ))
    story.append(spacer(4))
    
    story.append(Paragraph('결정적 차이: 출처 참조', S_H3))
    story.append(Paragraph(
        'Perplexity만의 고유 특성은 <b>실시간 웹 출처를 참조</b>한다는 것입니다. '
        '네이버 플레이스, 공식 웹사이트, 블로그 리뷰를 직접 크롤링하여 검증 후 추천합니다.',
        S_BODY_J
    ))
    
    story.append(spacer(6))
    
    story.append(make_data_table(
        ['조건', '멘션 가능성', '영향도', '우선순위'],
        [
            ['공식 웹사이트 보유', '필수 조건', '극대', '1순위'],
            ['네이버 플레이스 최적화', '핵심 트리거', '극대', '1순위'],
            ['가격/비용 정보 공개', '차별 트리거', '대', '2순위'],
            ['환자 리뷰 다수 확보', '신뢰 신호', '대', '2순위'],
            ['구조화된 FAQ', '정보 완성도', '중', '3순위'],
        ],
        col_widths=[130, 85, 65, 65]
    ))
    
    story.append(spacer(6))
    
    ppl_strategies = [
        '<b>1. 공식 웹사이트 필수</b> — Perplexity는 출처 기반 검증 AI. 웹사이트 없으면 사실상 멘션 불가. 진료과목, 의료진, 위치 정보를 명확하게 구조화하세요.',
        '<b>2. 네이버 플레이스 최적화</b> — 평점 4.5 이상, 리뷰 50개 이상, 영업정보 100% 완성. Perplexity가 직접 참조합니다.',
        '<b>3. 가격/비용 정보 투명 공개</b> — 타 플랫폼과 달리 가격 정보가 멘션 트리거. 시술별 가격대를 웹에 명시하세요.',
        '<b>4. RESERVATION(예약) 의도 대응</b> — Perplexity만이 예약 의도에서 6% 멘션 (타 플랫폼 2~6%). 접근성, 주차, 영업시간을 강조하세요.',
    ]
    for s in ppl_strategies:
        story.append(Paragraph(f'• {s}', S_BULLET))
    
    story.append(spacer(6))
    story.append(colored_box_table(
        'Perplexity 공식: 공식 웹사이트 + 네이버 평점 4.5↑ + 가격 투명성 = 1위 단독추천',
        C_PERPLEXITY, C_WHITE, 'NanumSquareEB', 12
    ))
    
    story.append(PageBreak())
    
    # ════════════════════════════════════════
    # SECTION 4: GEMINI
    # ════════════════════════════════════════
    story.append(Paragraph('04  Gemini 공략법', S_H1))
    story.append(Paragraph('키워드 다양성 + 지역 커버리지 전략',
                           make_style('s4sub', 'NanumSquare', 12, C_GEMINI, spaceAfter=8)))
    story.append(hr('100%', 2, C_GEMINI))
    story.append(spacer(4))
    
    gem_stats = Table([
        [stat_card('멘션율', '35.4%', '4개 중 최고!', C_GEMINI),
         stat_card('COMPARISON', '81.3%', '비교 질문 멘션율', C_GEMINI),
         stat_card('포지션 범위', '1~33위', '대량 나열형', C_GEMINI),
         stat_card('R3 단독추천', '38건', '4개 중 최저', C_GEMINI)]
    ], colWidths=[W/4]*4)
    gem_stats.setStyle(TableStyle([('ALIGN',(0,0),(-1,-1),'CENTER'), ('VALIGN',(0,0),(-1,-1),'TOP')]))
    story.append(gem_stats)
    story.append(spacer(8))
    
    story.append(Paragraph('Gemini의 특성', S_H2))
    story.append(Paragraph(
        'Gemini는 가장 "관대한" AI입니다. 멘션율 35.4%로 최고이며, 한 응답에 30개 이상 병원을 '
        '나열하기도 합니다. 하지만 R3 단독추천은 38건으로 최저 — <b>"많이 추천하되, 특정 병원을 '
        '깊이 있게 추천하지는 않는"</b> 패턴입니다.',
        S_BODY_J
    ))
    story.append(spacer(4))
    
    story.append(Paragraph('Gemini만의 키워드 패턴', S_H3))
    story.append(make_data_table(
        ['키워드', '출현율', 'ChatGPT대비', '의미'],
        [
            ['전문', '80.5%', '+15.1%p', '가장 중시하는 키워드'],
            ['전문의', '65.1%', '+9.8%p', '자격 키워드 중시'],
            ['교정', '63.2%', '+25.8%p', '교정 분야 민감'],
            ['충치', '36.3%', '+18.5%p', '일반진료도 포함'],
            ['가격', '41.0%', '+2.4배', '가격 정보 활용'],
            ['사랑니', '28.6%', '+19.8%p', 'Gemini만 반응'],
        ],
        col_widths=[80, 75, 85, 140]
    ))
    
    story.append(spacer(6))
    
    gem_strategies = [
        '<b>1. 진료과목을 최대한 다양하게 노출</b> — 임플란트뿐 아니라 충치, 사랑니, 스케일링 같은 일반 진료까지 커버하면 Gemini 멘션 확률이 크게 올라갑니다.',
        '<b>2. COMPARISON(비교) 질문 콘텐츠 필수</b> — "A치과 vs B치과" 비교 질문에서 81.3% 멘션! 경쟁병원 대비 차별점을 명확히 하는 콘텐츠를 만드세요.',
        '<b>3. 지역 키워드 다양화</b> — 천안, 서울, 수원 등 지역명 + 진료과목 조합. 동 단위까지 세분화하면 지역 기반 추천에 유리합니다.',
        '<b>4. 전문의 자격을 반드시 명시</b> — Gemini 멘션의 65%에 "전문의"가 등장. 학력, 경력, 수련 이력을 웹에 상세히 기재하세요.',
    ]
    for s in gem_strategies:
        story.append(Paragraph(f'• {s}', S_BULLET))
    
    story.append(spacer(6))
    story.append(colored_box_table(
        'Gemini 공식: 전문의 자격 + 다양한 진료과목 + 지역 키워드 = 높은 멘션율 (목록 포함 노리기)',
        C_GEMINI, C_WHITE, 'NanumSquareEB', 12
    ))
    
    story.append(PageBreak())
    
    # ════════════════════════════════════════
    # SECTION 5: CLAUDE
    # ════════════════════════════════════════
    story.append(Paragraph('05  Claude 공략법', S_H1))
    story.append(Paragraph('권위 + 웹 신뢰도 전략',
                           make_style('s5sub', 'NanumSquare', 12, C_CLAUDE, spaceAfter=8)))
    story.append(hr('100%', 2, C_CLAUDE))
    story.append(spacer(4))
    
    cla_stats = Table([
        [stat_card('멘션율', '25.3%', '1,308건 / 5,172건', C_CLAUDE),
         stat_card('웹사이트有', '66.9%', '4개 중 최고!', C_CLAUDE),
         stat_card('네이버有', '66.1%', '4개 중 최고!', C_CLAUDE),
         stat_card('REVIEW 멘션율', '45.6%', '후기 질문 최강', C_CLAUDE)]
    ], colWidths=[W/4]*4)
    cla_stats.setStyle(TableStyle([('ALIGN',(0,0),(-1,-1),'CENTER'), ('VALIGN',(0,0),(-1,-1),'TOP')]))
    story.append(cla_stats)
    story.append(spacer(8))
    
    story.append(Paragraph('Claude의 특성', S_H2))
    story.append(Paragraph(
        'Claude는 가장 "신중한" AI입니다. <b>웹사이트 보유 병원 멘션이 66.9%</b>로 '
        '4개 플랫폼 중 가장 높습니다. 또한 <b>후기/리뷰 질문에서 45.6% 멘션율</b>을 보이며 '
        '환자 경험 기반의 추천을 선호합니다.',
        S_BODY_J
    ))
    story.append(spacer(4))
    
    story.append(Paragraph('Claude가 중시하는 요소', S_H3))
    story.append(make_data_table(
        ['요소', '멘션 응답 내 출현율', '다른 AI 평균', '중요도'],
        [
            ['웹사이트 보유', '66.9%', '50.1%', '★★★★★'],
            ['네이버 보유', '66.1%', '48.3%', '★★★★★'],
            ['전문의 키워드', '72.5%', '57.2%', '★★★★☆'],
            ['3D/디지털 키워드', '35.9%', '22.7%', '★★★★☆'],
            ['추천 키워드', '84.5%', '71.3%', '★★★☆☆'],
        ],
        col_widths=[100, 110, 90, 80]
    ))
    
    story.append(spacer(6))
    
    cla_strategies = [
        '<b>1. 웹사이트 + 네이버 둘 다 필수</b> — Claude 멘션의 67%가 웹+네이버 보유 병원. 두 채널 모두 완비해야 합니다.',
        '<b>2. 전문의 자격/학력/경력을 웹에 상세 게시</b> — "서울대 졸업", "전문의 취득" 등 권위 키워드가 72.5% 출현. 의료진 프로필 페이지를 강화하세요.',
        '<b>3. 후기/리뷰 질문 대응 콘텐츠</b> — Claude가 후기 의도에서 45.6% 멘션 (4개 중 최고). 실제 환자 후기를 웹에 체계적으로 정리하세요.',
        '<b>4. 3D/디지털/첨단 기술 콘텐츠</b> — Claude는 첨단 기술 키워드에 민감합니다. 장비 스펙, 기술 설명을 상세히 기재하세요.',
    ]
    for s in cla_strategies:
        story.append(Paragraph(f'• {s}', S_BULLET))
    
    story.append(spacer(6))
    story.append(colored_box_table(
        'Claude 공식: 전문의 권위 + 웹 & 네이버 존재감 + 기술 키워드 = 높은 멘션 + 추천',
        C_CLAUDE, C_WHITE, 'NanumSquareEB', 12
    ))
    
    story.append(PageBreak())
    
    # ════════════════════════════════════════
    # SECTION 6: INTENT STRATEGY
    # ════════════════════════════════════════
    story.append(Paragraph('06  질문 의도(Intent)별 전략', S_H1))
    story.append(hr())
    story.append(spacer(4))
    
    story.append(Paragraph(
        'AI에게 던지는 질문의 의도에 따라 멘션율과 추천 깊이가 완전히 달라집니다. '
        '21,369개 응답을 5가지 질문 의도별로 분석한 결과입니다.',
        S_BODY_J
    ))
    story.append(spacer(6))
    
    story.append(make_data_table(
        ['질문 의도', 'ChatGPT', 'Perplexity', 'Gemini', 'Claude', '최적 전략'],
        [
            ['COMPARISON\n(비교)', '60.5%', '31.8%', '81.3% ★', '77.6%', '경쟁 대비\n차별점 콘텐츠'],
            ['INFORMATION\n(정보탐색)', '45.1%', '23.0%', '53.2% ★', '43.0%', '진료정보 +\n전문성 강조'],
            ['REVIEW\n(후기)', '40.0%', '10.2%', '19.8%', '45.6% ★', '환자후기\n체계적 관리'],
            ['RESERVATION\n(예약)', '5.8%', '6.0% ★', '2.3%', '2.3%', '가격/접근성\n/영업시간 공개'],
            ['FEAR\n(공포/걱정)', '6.3%', '1.1%', '1.5%', '4.9%', '현재 AI가\n잘 못하는 영역'],
        ],
        col_widths=[72, 62, 62, 62, 62, 80]
    ))
    
    story.append(spacer(8))
    
    # Bar chart for intent
    chart_intent = create_bar_chart_image(
        ['비교', '정보탐색', '후기', '예약', '공포'],
        [81.3, 53.2, 45.6, 6.0, 6.3],
        ['#6C63FF', '#4285F4', '#D97706', '#20808D', '#E74C3C'],
        title='질문 의도별 최고 멘션율 (각 의도 1위 플랫폼 기준)'
    )
    story.append(chart_intent)
    
    story.append(spacer(8))
    
    story.append(Paragraph('핵심 인사이트', S_H3))
    insights = [
        '<b>비교 질문이 가장 효과적</b> — COMPARISON 의도에서 Gemini 81.3%, Claude 77.6%로 압도적 멘션율. "OO치과 vs OO치과" 형태의 질문에 대비하세요.',
        '<b>정보탐색이 볼륨의 핵심</b> — 전체 질문의 약 50%가 INFORMATION 의도. 기본기를 다져야 합니다.',
        '<b>예약/공포 의도는 아직 블루오션</b> — AI가 예약/공포 질문에 잘 응답하지 못합니다. 이 영역을 선점하면 차별화됩니다.',
        '<b>후기 질문은 Claude 타겟</b> — Claude만 45.6%로 유독 높음. 후기 콘텐츠 = Claude 공략.',
    ]
    for s in insights:
        story.append(Paragraph(f'• {s}', S_BULLET))
    
    story.append(PageBreak())
    
    # ════════════════════════════════════════
    # SECTION 7: TOP vs BOTTOM
    # ════════════════════════════════════════
    story.append(Paragraph('07  TOP10 vs BOTTOM10 분석', S_H1))
    story.append(hr())
    story.append(spacer(4))
    
    story.append(Paragraph(
        '76개 모니터링 병원 중 AI 가시성 점수 상위 10개와 하위 10개를 비교하면, '
        '성공 병원의 공통점이 명확하게 드러납니다.',
        S_BODY_J
    ))
    story.append(spacer(6))
    
    story.append(make_data_table(
        ['지표', 'TOP 10', 'BOTTOM 10', '차이'],
        [
            ['평균 점수', '68.9점', '6.4점', '10.8배'],
            ['SOV(점유율)', '51.1%', '0%', '∞'],
            ['평균 멘션수', '15.8회', '0회', '∞'],
            ['GPT 평균', '56.3', '0', '-'],
            ['Perplexity 평균', '30.9', '0', '-'],
            ['Gemini 평균', '66.3', '0', '-'],
            ['Claude 평균', '51.1', '0', '-'],
            ['웹사이트 보유율', '30%', '10%', '3배'],
            ['네이버 보유율', '20%', '0%', '∞'],
        ],
        col_widths=[110, 90, 90, 70]
    ))
    
    story.append(spacer(8))
    
    story.append(Paragraph('웹사이트 + 네이버의 결정적 차이', S_H2))
    
    story.append(make_data_table(
        ['보유 현황', '병원수', '평균 점수', '평균 멘션수', 'SOV'],
        [
            ['웹+네이버 둘 다', '9개', '43.2점', '10.2회', '23.1%'],
            ['웹사이트만', '4개', '23.8점', '2.8회', '12.5%'],
            ['네이버만', '1개', '42.0점', '5.0회', '11.0%'],
            ['둘 다 없음', '53개', '35.8점', '3.4회', '20.3%'],
        ],
        col_widths=[100, 70, 80, 85, 65]
    ))
    
    story.append(spacer(6))
    
    story.append(colored_box_table(
        '결론: 웹사이트 + 네이버 둘 다 보유 시 → 멘션수 3배, SOV 1.5배!  모든 병원이 가장 먼저 해야 할 일입니다.',
        C_RED, C_WHITE, 'NanumSquareB', 11
    ))
    
    story.append(spacer(10))
    
    story.append(Paragraph('BOTTOM 10 공통 특성', S_H3))
    bottom_chars = [
        '플랫폼 점수 전부 <b>0점</b> — AI가 아예 인식하지 못하는 상태',
        '웹사이트 보유율 10%, 네이버 보유율 <b>0%</b>',
        'AI에 노출되는 온라인 콘텐츠가 거의 없음',
        '병원 이름 자체가 일반적 (AI가 구별하기 어려움)',
    ]
    for s in bottom_chars:
        story.append(Paragraph(f'• {s}', S_BULLET))
    
    story.append(PageBreak())
    
    # ════════════════════════════════════════
    # SECTION 8: ACTION PLAN
    # ════════════════════════════════════════
    story.append(Paragraph('08  즉시 실행 액션 플랜', S_H1))
    story.append(hr())
    story.append(spacer(4))
    
    story.append(Paragraph(
        '데이터 분석 결과를 바탕으로, 즉시 실행할 수 있는 우선순위별 액션을 정리했습니다.',
        S_BODY_J
    ))
    story.append(spacer(6))
    
    # Priority 1: RED
    story.append(colored_box_table('우선순위 1  — 즉시 실행 (1~2주)', C_RED))
    story.append(spacer(4))
    
    p1_actions = [
        ['1-1', '모든 병원 웹사이트 구축', '멘션수 3배 차이의 결정적 요인. 최소 5페이지: 메인, 의료진, 진료과목, 오시는길, 후기'],
        ['1-2', '네이버 플레이스 100% 완성', '영업시간, 주소, 전화번호, 사진 20장+, 메뉴/가격 등록'],
        ['1-3', '전문의 자격/경력 웹 게시', '학력, 수련이력, 학회활동, 수술 건수를 정량적으로 기재'],
    ]
    story.append(make_data_table(
        ['번호', '액션', '상세 내용'],
        p1_actions,
        col_widths=[35, 130, 215],
        header_bg=C_RED
    ))
    story.append(spacer(8))
    
    # Priority 2: ORANGE
    story.append(colored_box_table('우선순위 2  — 2~4주 내 실행', C_ORANGE))
    story.append(spacer(4))
    
    p2_actions = [
        ['2-1', '진료과목별 전문 콘텐츠', '임플란트(+20%), 디지털(+15%) 키워드가 ChatGPT 멘션 트리거'],
        ['2-2', '비교 콘텐츠 제작', 'Gemini 81%, Claude 78% 멘션의 핵심 의도. "우리 병원 vs 경쟁" 형태'],
        ['2-3', '가격 투명성 확보', 'Perplexity 전용 공략. 시술별 가격대를 웹에 명시'],
        ['2-4', '환자 후기 체계적 관리', 'Claude 45.6% 후기 멘션율. 네이버/구글 리뷰 적극 관리'],
    ]
    story.append(make_data_table(
        ['번호', '액션', '상세 내용'],
        p2_actions,
        col_widths=[35, 130, 215],
        header_bg=C_ORANGE
    ))
    story.append(spacer(8))
    
    # Priority 3: GREEN
    story.append(colored_box_table('우선순위 3  — 지속적 운영', C_GREEN))
    story.append(spacer(4))
    
    p3_actions = [
        ['3-1', '월간 AI 가시성 점수 모니터링', 'Patient Signal로 매월 점수 변화 추적'],
        ['3-2', '경쟁병원 벤치마킹', '경쟁병원의 AI 점수/멘션 변화를 추적하여 전략 조정'],
        ['3-3', '콘텐츠 A/B 테스트', '키워드 변경 후 2주간 점수 변화 관찰'],
        ['3-4', '플랫폼별 맞춤 최적화', '약한 플랫폼부터 집중 개선'],
    ]
    story.append(make_data_table(
        ['번호', '액션', '상세 내용'],
        p3_actions,
        col_widths=[35, 145, 200],
        header_bg=C_GREEN
    ))
    
    story.append(PageBreak())
    
    # ════════════════════════════════════════
    # CLOSING PAGE
    # ════════════════════════════════════════
    story.append(spacer(30))
    
    story.append(colored_box_table(
        'PATIENT SIGNAL', C_PRIMARY, C_WHITE, 'NanumSquareEB', 18
    ))
    story.append(spacer(15))
    
    story.append(Paragraph(
        'AI 시대,<br/>환자가 당신의 병원을 찾는 방법이 바뀌었습니다.',
        make_style('closing1', 'NanumSquareEB', 22, C_PRIMARY, TA_CENTER, 12, leading=32)
    ))
    story.append(spacer(8))
    
    story.append(Paragraph(
        'Patient Signal은 4개 AI 플랫폼에서 당신의 병원이<br/>'
        '어떻게 추천되고 있는지 실시간으로 모니터링합니다.',
        make_style('closing2', 'NanumSquare', 13, C_TEXT, TA_CENTER, 8, leading=20)
    ))
    story.append(spacer(6))
    
    story.append(hr('40%', 2, C_ACCENT))
    story.append(spacer(6))
    
    # Feature list
    features = [
        'AI 가시성 점수 실시간 대시보드',
        '4개 AI 플랫폼 동시 모니터링',
        '경쟁병원 벤치마킹 분석',
        '맞춤형 콘텐츠 개선 제안',
        '주간/월간 리포트 자동 발송',
    ]
    for f in features:
        story.append(Paragraph(
            f'<font name="NanumSquare" color="#6C63FF">✓</font>  {f}',
            make_style('feat', 'NanumSquare', 12, C_TEXT, TA_CENTER, 6, leading=18)
        ))
    
    story.append(spacer(15))
    
    story.append(Paragraph(
        '<font name="NanumSquareEB" size="16" color="#6C63FF">https://patientsignal.co.kr</font>',
        make_style('url_final', alignment=TA_CENTER)
    ))
    story.append(spacer(6))
    story.append(Paragraph(
        '지금 무료로 시작하세요',
        make_style('cta', 'NanumSquareB', 14, C_ACCENT, TA_CENTER, 20, leading=20)
    ))
    
    story.append(spacer(20))
    story.append(hr('60%', 1, colors.HexColor('#DEE2E6')))
    story.append(spacer(4))
    
    story.append(Paragraph(
        '본 리포트는 Patient Signal에서 2026년 3~4월 수집한 21,369건의 AI 응답 데이터를 기반으로 작성되었습니다.<br/>'
        '76개 의료기관의 실증 데이터에 기반한 분석이며, AI 플랫폼의 알고리즘 변경에 따라 결과가 달라질 수 있습니다.<br/>'
        '© 2026 Patient Signal. All rights reserved.',
        make_style('disclaimer', 'NanumSquareL', 8, C_TEXT_LIGHT, TA_CENTER, leading=12)
    ))
    
    # ── BUILD ──
    doc.build(story, onFirstPage=page_header_footer, onLaterPages=page_header_footer)
    print(f'PDF generated: {output_path}')
    return output_path

if __name__ == '__main__':
    path = build_report()
    print(f'Done! File size: {os.path.getsize(path) / 1024:.1f} KB')
