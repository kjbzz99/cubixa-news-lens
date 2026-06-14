-- Cubixa News Lens Database Schema

-- RSS Sources (14 news agencies)
CREATE TABLE IF NOT EXISTS rss_sources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  url VARCHAR(500) NOT NULL,
  category VARCHAR(50),
  color VARCHAR(20),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Articles from RSS feeds
CREATE TABLE IF NOT EXISTS articles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id INT NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  link VARCHAR(500) UNIQUE NOT NULL,
  pub_date TIMESTAMP,
  content TEXT,
  image_url VARCHAR(500),
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES rss_sources(id),
  INDEX idx_source_id (source_id),
  INDEX idx_pub_date (pub_date),
  INDEX idx_created_at (created_at)
);

-- Analysis results
CREATE TABLE IF NOT EXISTS analysis_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  article_id INT NOT NULL,
  summary TEXT,
  overall_score INT,
  source_credibility INT,
  headline_body_match INT,
  emotional_language INT,
  fact_opinion_distinction INT,
  evidence_presence INT,
  exaggeration_absoluteness INT,
  political_commercial_bias INT,
  logical_fallacy INT,
  final_judgment INT,
  risk_signals JSON,
  reliable_elements JSON,
  recommendations TEXT,
  trust_grade VARCHAR(5),
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id),
  INDEX idx_article_id (article_id),
  INDEX idx_trust_grade (trust_grade)
);

-- Insert 14 Korean news sources
INSERT INTO rss_sources (name, url, category, color) VALUES
('조선일보', 'https://www.chosun.com/rss/', '종합', '#FF6B6B'),
('중앙일보', 'https://www.joongang.co.kr/rss/', '종합', '#4ECDC4'),
('동아일보', 'https://www.donga.com/rss/', '종합', '#45B7D1'),
('한겨레', 'https://www.hani.co.kr/rss/', '종합', '#96CEB4'),
('경향신문', 'https://www.khan.co.kr/rss/', '종합', '#FFEAA7'),
('매일경제', 'https://www.mk.co.kr/rss/', '경제', '#DDA15E'),
('한국경제', 'https://www.hankyung.com/rss/', '경제', '#BC6C25'),
('뉴스1', 'https://www.news1.kr/rss/', '종합', '#E63946'),
('뉴시스', 'https://www.newsis.com/rss/', '종합', '#457B9D'),
('연합뉴스', 'https://www.yonhapnews.co.kr/rss/', '종합', '#1D3557'),
('BBC News', 'http://feeds.bbc.co.uk/news/rss.xml', '국제', '#264653'),
('CNN', 'http://rss.cnn.com/rss/edition.rss', '국제', '#2A9D8F'),
('Reuters', 'https://www.reuters.com/rssFeed/worldNews', '국제', '#E76F51'),
('AP News', 'https://apnews.com/apf-services/v2/rss/summary/news.rss', '국제', '#F4A261');
