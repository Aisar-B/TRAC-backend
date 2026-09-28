import { supabase } from '../config/supabase.js';

export const getActivityLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20,
      admin_id,
      action,
      start_date,
      end_date,
      search
    } = req.query;

    let query = supabase
      .from('admin_activity_logs')
      .select(`
        *,
        admins:admin_id (id, username, full_name),
        requests:request_id (tracking_code, request_type, purpose, sender_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (admin_id) {
      query = query.eq('admin_id', admin_id);
    }
    if (action) {
      query = query.eq('action', action);
    }
    if (start_date) {
      query = query.gte('created_at', start_date);
    }
    if (end_date) {
      query = query.lte('created_at', end_date);
    }
    
    if (search && search.trim()) {
      
      const { data: matchingRequests } = await supabase
        .from('requests')
        .select('id')
        .or(`tracking_code.ilike.%${search}%,sender_name.ilike.%${search}%,sender_id_number.ilike.%${search}%`);
      
      const requestIds = matchingRequests?.map(r => r.id) || [];
      
      const { data: matchingAdmins } = await supabase
        .from('admins')
        .select('id')
        .or(`username.ilike.%${search}%,full_name.ilike.%${search}%`);
      
      const adminIds = matchingAdmins?.map(a => a.id) || [];
      
      if (requestIds.length > 0 || adminIds.length > 0) {
        query = query.or(
          `request_id.in.(${requestIds.join(',') || 'null'}),admin_id.in.(${adminIds.join(',') || 'null'})`
        );
      } else {
        
        return res.status(200).json({
          logs: [],
          summary: { total: 0, byAction: { approved: 0, processing: 0, ready: 0, claimed: 0, rejected: 0 } },
          admins: [],
          pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, pages: 0 }
        });
      }
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: logs, error, count } = await query
      .range(from, to);

    if (error) throw error;

    let summaryQuery = supabase.from('admin_activity_logs').select('action');
    
    if (admin_id) summaryQuery = summaryQuery.eq('admin_id', admin_id);
    if (action) summaryQuery = summaryQuery.eq('action', action);
    if (start_date) summaryQuery = summaryQuery.gte('created_at', start_date);
    if (end_date) summaryQuery = summaryQuery.lte('created_at', end_date);
    
    const { data: allLogs } = await summaryQuery;

    const summary = {
      total: count || 0,
      byAction: {
        approved: allLogs?.filter(l => l.action === 'approved').length || 0,
        processing: allLogs?.filter(l => l.action === 'processing').length || 0,
        ready: allLogs?.filter(l => l.action === 'ready').length || 0,
        claimed: allLogs?.filter(l => l.action === 'claimed').length || 0,
        rejected: allLogs?.filter(l => l.action === 'rejected').length || 0
      }
    };

    const { data: admins } = await supabase
      .from('admins')
      .select('id, username, full_name')
      .eq('is_active', true);

    res.status(200).json({
      logs: logs || [],
      summary,
      admins: admins || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (err) {
    console.error('Get activity logs error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getActivityLogById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: log, error } = await supabase
      .from('admin_activity_logs')
      .select(`
        *,
        admins:admin_id (id, username, full_name),
        requests:request_id (tracking_code, request_type, purpose, status, copies, sender_name, sender_id_number)
      `)
      .eq('id', id)
      .single();

    if (error || !log) {
      return res.status(404).json({ message: 'Activity log not found' });
    }

    res.status(200).json(log);

  } catch (err) {
    console.error('Get activity log by ID error:', err);
    res.status(500).json({ error: err.message });
  }
};