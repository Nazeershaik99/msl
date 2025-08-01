from flask import Flask, render_template, request, jsonify, make_response
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
import io
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
import logging
from datetime import datetime
from flask import Flask, render_template, send_from_directory
import os


app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration
DATABASE_CONFIG = {
    'host': 'localhost',
    'database': 'postgres',
    'user': 'postgres',
    'password': '1234',
    'port': '5432'
}

DATABASE_URL = f"postgresql://{DATABASE_CONFIG['user']}:{DATABASE_CONFIG['password']}@{DATABASE_CONFIG['host']}:{DATABASE_CONFIG['port']}/{DATABASE_CONFIG['database']}"
engine = create_engine(DATABASE_URL)

CURRENT_USER = 'Nazeershaik99'
CURRENT_UTC_TIME = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')


def get_current_utc_time():
    return datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')

def load_data():
    try:
        query = "SELECT * FROM mslpoint"
        df = pd.read_sql_query(query, engine)
        logger.info(f"Successfully loaded {len(df)} records from database")
        df.columns = df.columns.str.lower().str.replace(' ', '_')
        return df
    except SQLAlchemyError as e:
        logger.error(f"Database query error: {e}")
        return pd.DataFrame()
    except Exception as e:
        logger.error(f"Unexpected error loading data: {e}")
        return pd.DataFrame()

df = load_data()

def parse_mls_row(row):
    """Return a dict with all columns, using snake_case keys frontend & PDF expect."""
    d = row.to_dict()
    return {
        "mls_point_code": d.get("mls_point_code", ""),
        "mls_point_name": d.get("mls_point_name", ""),
        "district_code": d.get("district_code", ""),
        "district_name": d.get("district_name", ""),
        "mandal_code": d.get("mandal_code", ""),
        "mandal_name": d.get("mandal_name", ""),
        "village_name": d.get("village_name", ""),
        "latitude": float(d.get("mls_point_latitude", 0.0)),
        "longitude": float(d.get("mls_point_logitude", d.get("mls_point_longitude", 0.0))),
        "mls_point_address": d.get("mls_point_address", ""),
        "mls_point_incharge_cfms": d.get("mls_point_incharge_cfms/_corporation_emp_id", ""),
        "mls_point_incharge_name": d.get("mls_point_incharge_name", ""),
        "designation": d.get("designation", ""),
        "aadhaar_number": d.get("aadhaar_number", ""),
        "phone_number": d.get("phone_number", ""),
        "deo_cfms_id": d.get("deo_cfms_id_/_corporation_emp_id", ""),
        "deo_name": d.get("deo_name", ""),
        "deo_aadhaar_number": d.get("aadhaarnumber", ""),
        "deo_phone_number": d.get("deo_phone_number", ""),
        "godown_area_sqft": d.get("godown_area_in_sq._ft.", ""),
        "storage_capacity_mt": d.get("storage_capacity_in_mts.", ""),
        "mls_point_owned_or_hired": d.get("mls_point_owned_(or)_hired_?", ""),
        "if_rented": d.get("if_rented,_(private_/_amc_/_other)", ""),
        "weighbridge_available": d.get("weighbridge_available?_(yes_/_no)", ""),
        "cc_cameras_installed": d.get("no._of_cc_camers_installed", ""),
        "cameras_working": d.get("whether_all_cameras_are_in_working_condition?_(yes/no)", ""),
        "cameras_maintained_by_vendor": d.get("cc_cameras_are_maintained_by_vendor", ""),
        "num_hamalies_working": d.get("number_of_hamalies_working", ""),
        "num_stage2_vehicles": d.get("number_of_stage_-_ii_vehicles_registered", ""),
        "all_vehicles_gps": d.get("all_vehicles_having_gps_devices?_(yes/no)", ""),
        "compound_wall_available": d.get("compound_wall_available?_(yes/no)", ""),
        "distance_from_main_road_km": d.get("distance_from_main_road_to_reach_mls?_(in_kms)", ""),
        "internal_roads_available": d.get("internal_roads_available?_(yes/no)", ""),
        "solar_system_available": d.get("solar_system_available?_(yes/no)", ""),
        "can_be_green_godown": d.get("whether_mls_can_be_converted_to_green_godown_with_solar?_(yes/no)", ""),
        "last_minor_repairs": d.get("when_was_last_time_minor_repairs_done?", ""),
        "last_paintings": d.get("when_was_last_time_paintings_done?", ""),
    }


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard.html')
def dashboard():
    return render_template('dashboard.html')

# Serve static files
@app.route('/styles.css')
def styles():
    return send_from_directory('templates', 'styles.css')

@app.route('/dashboard.css')
def dashboard_css():
    return send_from_directory('templates', 'dashboard.css')

@app.route('/js/<filename>')
def js_files(filename):
    return send_from_directory('templates/js', filename)

@app.route('/api/districts')
def get_districts():
    try:
        if df.empty:
            return jsonify([])
        districts = df[['district_code', 'district_name']].drop_duplicates().sort_values('district_name')
        districts_list = [
            {
                'District Code': row['district_code'],
                'District Name': row['district_name']
            }
            for _, row in districts.iterrows()
        ]
        return jsonify(districts_list)
    except Exception as e:
        logger.error(f"Error fetching districts: {e}")
        return jsonify({'error': 'Failed to fetch districts'}), 500

@app.route('/api/mandals/<district_code>')
def get_mandals(district_code):
    try:
        if df.empty:
            logger.error(f"No data available in dataframe for district {district_code}")
            return jsonify([])
        district_code = str(district_code)
        filtered_df = df[df['district_code'].astype(str) == district_code]
        if filtered_df.empty:
            logger.warning(f"No mandals found for district code {district_code}")
            return jsonify([])
        mandals = filtered_df[['mandal_code', 'mandal_name']].drop_duplicates().sort_values('mandal_name')
        mandals_list = []
        for _, row in mandals.iterrows():
            mandal_dict = {
                'Mandal Code': str(row['mandal_code']),
                'Mandal Name': str(row['mandal_name'])
            }
            mandals_list.append(mandal_dict)
        return jsonify(mandals_list)
    except Exception as e:
        logger.error(f"Error fetching mandals for district {district_code}: {str(e)}")
        return jsonify({
            'error': 'Failed to fetch mandals',
            'district_code': district_code,
            'timestamp': get_current_utc_time(),
            'user': CURRENT_USER
        }), 500

@app.route('/api/mls_points/<district_code>/<mandal_code>')
def get_mls_points(district_code, mandal_code):
    try:
        if df.empty:
            return jsonify([])
        filtered_df = df[
            (df['district_code'].astype(str) == str(district_code)) &
            (df['mandal_code'].astype(str) == str(mandal_code))
        ]
        points = []
        for _, row in filtered_df.iterrows():
            parsed = parse_mls_row(row)
            if parsed["latitude"] == 0.0 or parsed["longitude"] == 0.0:
                continue
            points.append(parsed)
        return jsonify(points)
    except Exception as e:
        logger.error(f"Error fetching MLS points: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/mls_details/<mls_code>')
def get_mls_details(mls_code):
    try:
        if df.empty:
            return jsonify({'error': 'No data available'}), 404
        mls_code = str(mls_code).strip()
        mls_record = df[df['mls_point_code'].astype(str).str.strip().str.upper() == mls_code.upper()]
        if mls_record.empty:
            return jsonify({'error': 'MLS point not found'}), 404
        details = parse_mls_row(mls_record.iloc[0])
        return jsonify({'success': True, 'mls_point': details})
    except Exception as e:
        logger.error(f"Error fetching MLS details for code {mls_code}: {str(e)}")
        return jsonify({'error': 'Failed to fetch MLS details', 'message': str(e)}), 500

@app.route('/api/search_mls_code/<mls_code>')
def search_mls_code(mls_code):
    try:
        if df.empty:
            return jsonify({'error': 'No data available'}), 404
        mls_code = str(mls_code).strip()
        mls_record = df[df['mls_point_code'].astype(str).str.strip().str.upper() == mls_code.upper()]
        if mls_record.empty:
            return jsonify({'error': 'MLS point not found'}), 404
        details = parse_mls_row(mls_record.iloc[0])
        return jsonify({'success': True, 'mls_point': details})
    except Exception as e:
        logger.error(f"Error searching MLS code {mls_code}: {str(e)}")
        return jsonify({'error': 'Failed to search MLS code', 'message': str(e)}), 500

@app.route('/api/all_mls_codes')
def get_all_mls_codes():
    try:
        if df.empty:
            return jsonify([])
        mls_codes = df['mls_point_code'].astype(str).str.strip().unique()
        mls_codes = [code for code in mls_codes if code and code != 'nan']
        mls_codes.sort()
        return jsonify(mls_codes)
    except Exception as e:
        logger.error(f"Error fetching MLS codes: {e}")
        return jsonify({'error': 'Failed to fetch MLS codes'}), 500

@app.route('/api/download_pdf/<mls_code>')
def download_pdf(mls_code):
    try:
        if df.empty:
            return jsonify({'error': 'No data available'}), 404
        mls_code = str(mls_code)
        mls_record = df[df['mls_point_code'].astype(str) == mls_code]
        if mls_record.empty:
            return jsonify({'error': 'MLS point not found'}), 404
        details = parse_mls_row(mls_record.iloc[0])
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []
        title_style = ParagraphStyle('title', fontSize=14, alignment=TA_CENTER, textColor=colors.darkblue, spaceAfter=10)
        story.append(Paragraph("<b>MLS Point Details</b>", title_style))
        # Add all details to table
        table_data = [[k.replace('_', ' ').title(), v] for k, v in details.items()]
        story.append(Table(table_data, colWidths=[2.5*inch, 3.5*inch]))
        doc.build(story)
        buffer.seek(0)
        pdf_bytes = buffer.getvalue()
        filename = f"{details['mls_point_code']}_{details['mls_point_name'].replace(' ', '_')}.pdf"
        response = make_response(pdf_bytes)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
    except Exception as e:
        logger.error(f"PDF generation error: {e}")
        return jsonify({'error': 'PDF generation failed', 'message': str(e)}), 500

@app.route('/api/health')
def health_check():
    try:
        test_query = "SELECT 1"
        result = pd.read_sql_query(test_query, engine)
        return jsonify({
            'status': 'healthy',
            'database': 'connected',
            'records_count': len(df),
            'timestamp': get_current_utc_time(),
            'user': CURRENT_USER
        })
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'unhealthy',
            'database': 'disconnected',
            'error': str(e),
            'timestamp': get_current_utc_time(),
            'user': CURRENT_USER
        }), 500

@app.route('/api/user')
def get_current_user():
    return jsonify({
        'user': CURRENT_USER,
        'timestamp': CURRENT_UTC_TIME
    })

@app.before_request
def before_request():
    global CURRENT_UTC_TIME
    CURRENT_UTC_TIME = get_current_utc_time()

if __name__ == '__main__':
    CURRENT_UTC_TIME = get_current_utc_time()
    logger.info(f"Starting application at {CURRENT_UTC_TIME}")
    logger.info(f"Current user: {CURRENT_USER}")
    app.run(debug=True, host='0.0.0.0', port=5000)