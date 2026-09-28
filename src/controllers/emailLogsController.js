import { supabase } from '../config/supabase.js';

// =============================================
// GET ALL EMAIL LOGS (with filters)
// =============================================
export const getEmailLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20,
      status,        // 'sent' or 'failed'
      email_type,     // 'approved', 'ready', 'rejected'
      start_date,
      end_date,
      request_id
    } = req.query;

    // Build query
    let query = supabase
      .from('email_logs')
      .select(`
        *,
        requests (
          tracking_code,
          request_type
        )
      `, { count: 'exact' })
      .order('sent_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (email_type) {
      query = query.eq('email_type', email_type);
    }

    if (request_id) {
      query = query.eq('request_id', request_id);
    }

    if (start_date) {
      query = query.gte('sent_at', start_date);
    }

    if (end_date) {
      query = query.lte('sent_at', end_date);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: logs, error, count } = await query
      .range(from, to);

    if (error) throw error;

    // Get summary statistics
    const { data: summary } = await supabase
      .from('email_logs')
      .select('status, email_type')
      .then(result => {
        const stats = {
          total: count,
          sent: result.data?.filter(l => l.status === 'sent').length || 0,
          failed: result.data?.filter(l => l.status === 'failed').length || 0,
          byType: {
            approved: result.data?.filter(l => l.email_type === 'approved').length || 0,
            ready: result.data?.filter(l => l.email_type === 'ready').length || 0,
            rejected: result.data?.filter(l => l.email_type === 'rejected').length || 0
          }
        };
        return { data: stats };
      });

    res.status(200).json({
      logs: logs || [],
      summary: summary || {
        total: 0,
        sent: 0,
        failed: 0,
        byType: { approved: 0, ready: 0, rejected: 0 }
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (err) {
    console.error('Get email logs error:', err);
    res.status(500).json({ error: err.message });
  }
};

// =============================================
// GET EMAIL LOG BY ID
// =============================================
export const getEmailLogById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: log, error } = await supabase
      .from('email_logs')
      .select(`
        *,
        requests (
          tracking_code,
          request_type,
          purpose,
          copies,
          status
        )
      `)
      .eq('id', id)
      .single();

    if (error || !log) {
      return res.status(404).json({ message: 'Email log not found' });
    }

    res.status(200).json(log);

  } catch (err) {
    console.error('Get email log by ID error:', err);
    res.status(500).json({ error: err.message });
  }
};

// =============================================
// GET EMAIL LOGS SUMMARY (for dashboard)
// =============================================
export const getEmailLogsSummary = async (req, res) => {
  try {
    const { days = 7 } = req.query;

    // Get daily summary for last N days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: daily, error } = await supabase
      .from('email_logs')
      .select('sent_at, status, email_type')
      .gte('sent_at', startDate.toISOString());

    if (error) throw error;

    // Group by date
    const groupedByDate = {};
    daily.forEach(log => {
      const date = new Date(log.sent_at).toISOString().split('T')[0];
      if (!groupedByDate[date]) {
        groupedByDate[date] = {
          date,
          sent: 0,
          failed: 0,
          approved: 0,
          ready: 0,
          rejected: 0
        };
      }
      
      if (log.status === 'sent') groupedByDate[date].sent++;
      else groupedByDate[date].failed++;
      
      if (log.email_type === 'approved') groupedByDate[date].approved++;
      else if (log.email_type === 'ready') groupedByDate[date].ready++;
      else if (log.email_type === 'rejected') groupedByDate[date].rejected++;
    });

    const summary = Object.values(groupedByDate).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );

    res.status(200).json({
      daily: summary,
      total: daily.length,
      period: `${days} days`
    });

  } catch (err) {
    console.error('Get email logs summary error:', err);
    res.status(500).json({ error: err.message });
  }
};

// =============================================
// RETRY FAILED EMAIL
// =============================================
export const retryFailedEmail = async (req, res) => {
  try {
    const { id } = req.params;

    // Get the failed email log
    const { data: log, error } = await supabase
      .from('email_logs')
      .select('*')
      .eq('id', id)
      .eq('status', 'failed')
      .single();

    if (error || !log) {
      return res.status(404).json({ message: 'Failed email log not found' });
    }

    // Get the associated request
    const { data: request, error: reqError } = await supabase
      .from('requests')
      .select('*')
      .eq('id', log.request_id)
      .single();

    if (reqError || !request) {
      return res.status(404).json({ message: 'Associated request not found' });
    }

    // Import and use email service
    const { sendStatusEmail } = await import('../services/emailService.js');
    
    // The email service will create a new log entry
    const result = await sendStatusEmail(
      request, 
      log.email_type, 
      log.email_type === 'rejected' ? 'Retry attempt' : null
    );

    if (result.success) {
      res.status(200).json({ 
        message: 'Email resent successfully',
        new_log_id: result.logId 
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to resend email',
        error: result.error 
      });
    }

  } catch (err) {
    console.error('Retry email error:', err);
    res.status(500).json({ error: err.message });
  }
};